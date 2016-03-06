'use strict';

angular.module('changeTracker', [])
    .factory('changeTracker', function ($log) {
        var exports = {
            watch: watch,
            hasChangesOnScope: hasChangesOnScope,
            hasChanges: hasChanges,
            reset: reset,
            clear: clear,
            clearAll: clearAll,
            updateModelChanges:updateModelChanges
        };
        var scopeChangesCache = {};

        function watch(scope, target, ignored, isRestricted) {
            //Wrap ignored
            var ignoredList = [];
            if (angular.isArray(ignored)) {
                ignoredList = ignored;
            } else if (ignored) {
                ignoredList.push(ignored);
            }

            if (angular.isArray(target)) {
                for (var index in target) {
                    var modelName = target[index];
                    if (angular.isString(modelName)) {
                        watchModel(scope, modelName, ignoredList, isRestricted);
                    } else {
                        $log.error('Invalide model name:' + target[index]);
                    }
                }
            } else if (angular.isString(target)) {
                watchModel(scope, target, ignoredList, isRestricted);
            } else {
                $log.error('Invalide model name:' + target);
            }
        }

        function watchModel(scope, modelName, ignoredList, isRestricted) {
            // Register scope if not exist in scopeChangesCache
            if (angular.isUndefined(scopeChangesCache[scope.$id])) {
                scopeChangesCache[scope.$id] = {
                    hasChanges: false,
                    scope: scope
                };
            }

            //Add a change tracker on scope if not exist
            if (angular.isUndefined(scope.tracker)) {
                scope.tracker = {};
            }

            //Remove old watcher on the tracker if it has been watched
            if (scope.tracker[modelName] && scope.tracker[modelName].unwatch) {
                scope.tracker[modelName].unwatch();
                delete scope.tracker[modelName];
            }

            //Tracker model
            scope.tracker[modelName] = {};
            scope.tracker[modelName].original = angular.copy($$eval(scope, modelName));
            scope.tracker[modelName].hasChanges = false;
            scope.tracker[modelName].unwatch = scope.$watch(modelName, function (newValue, oldValue) {
                if (newValue !== oldValue) {
                    //$log.debug(modelName + ' is changed, new value: ' + newValue + ', old value: ' + oldValue);
                    updateModelChanges(scope, modelName, ignoredList, isRestricted);
                }
            }, true);

            //update scope change status
            scope.hasChanges = hasChangesOnScope(scope);
            updateScopeChangesCache(scope);
        }


        function $$eval(scope, modelName) {
            var attributes = modelName.split('.');
            if (attributes.length == 0)
                return;

            var current = null;
            for (var i = 0; i < attributes.length; i++) {
                if (i == 0) {
                    current = scope[attributes[i]];
                } else {
                    current = current[attributes[i]];
                }
            }
            return current;
        }

        // Update watched model changes
        function updateModelChanges(scope, modelName, ignoredList, isRestricted) {

            var original = scope.tracker[modelName].original;
            var current = $$eval(scope, modelName);

            // update model hasChanges
            scope.tracker[modelName].hasChanges = !equals(current, original, ignoredList, isRestricted);

            // update scope hasChanges
            if (scope.tracker[modelName].hasChanges) {
                scope.hasChanges = true;
                updateScopeChangesCache(scope);
            } else {
                scope.hasChanges = hasChangesOnScope(scope);
                updateScopeChangesCache(scope);
            }
        }

        // Update scope changes in cache map
        function updateScopeChangesCache(scope) {
            if (angular.isUndefined(scopeChangesCache[scope.$id])) {
                scopeChangesCache[scope.$id] = {
                    hasChanges: false,
                    scope: scope
                };
            }
            scopeChangesCache[scope.$id].hasChanges = scope.hasChanges;
        }

        // Check if exists changes in watched scope
        function hasChangesOnScope(scope) {
            for (var modelName in scope.tracker) {
                var modelTracker = scope.tracker[modelName];
                if (modelTracker.hasChanges) {
                    return true;
                }
            }
            return false;
        }

        // Check if exists changes in watch list
        function hasChanges() {
            for (var scopeId in scopeChangesCache) {
                if (scopeChangesCache[scopeId].hasChanges) {
                    return true;
                }
            }
            return false;
        }

        // Reset scope change tracker
        function reset(scope) {
            scope.hasChanges = false;
            updateScopeChangesCache(scope);

            angular.forEach(scope.tracker, function (modelTracker, modelName) {
                var current = $$eval(scope, modelName)
                modelTracker.original = angular.copy(current);
                modelTracker.hasChanges = false;
            });
        }

        // Clear scope change tracker
        function clear(scope) {
            scope.hasChanges = false;
            updateScopeChangesCache(scope);

            var doUnwatch = function () {
                angular.forEach(scope.tracker, function (modelTracker) {
                    if (modelTracker.unwatch) {
                        modelTracker.unwatch();
                    }
                });
            };

            // prevent clear parent scope tracker
            if (scope.$parent && scope.$parent.tracker && scope.tracker && scope.tracker !== scope.$parent.tracker) {
                doUnwatch();
            } else if (!scope.$parent && scope.tracker) {
                doUnwatch();
            }

            scope.tracker = {};
        }

        // Clear all change trackers in watch list
        function clearAll() {
            for (var scopeId in scopeChangesCache) {
                var scope = scopeChangesCache[scopeId].scope
                if (scope) {
                    clear(scope);
                }
            }
        }


        //======================================
        //     Customized equals methods
        //======================================

        var toString = Object.prototype.toString;

        function isRegExp(value) {
            return toString.call(value) === '[object RegExp]';
        }

        function isScope(obj) {
            return obj && obj.$evalAsync && obj.$watch;
        }

        function isWindow(obj) {
            return obj && obj.window === obj;
        }

        //change angularjs equals
        function equals(o1, o2, ignoredList, isRestricted) {
            if (o1 === o2) return true;

            if (!isRestricted) {
                if (angular.isUndefined(o1) && o2 === '')
                    return true;

                if (angular.isUndefined(o2) && o1 === '')
                    return true;

                if (angular.isUndefined(o1) && o2 === null)
                    return true;

                if (angular.isUndefined(o2) && o1 === null)
                    return true;

                if (o1 === '' && o2 === null)
                    return true;

                if (o2 === '' && o1 === null)
                    return true;
            }

            if (o1 === null || o2 === null) {
                return false;
            }
            if (o1 !== o1 && o2 !== o2) return true; // NaN === NaN
            var t1 = typeof o1,
                t2 = typeof o2,
                length, key, keySet;


            if (t1 == t2) {
                if (t1 == 'object') {
                    if (angular.isArray(o1)) {
                        if (!angular.isArray(o2)) {
                            return false;
                        }
                        if ((length = o1.length) == o2.length) {
                            for (key = 0; key < length; key++) {
                                //ingore key
                                if (ignoredList.indexOf(key) >= 0) continue;

                                if (!equals(o1[key], o2[key], ignoredList, isRestricted)) {
                                    return false;
                                }
                            }
                            return true;
                        }
                    } else if (angular.isDate(o1)) {
                        if (!angular.isDate(o2)) {
                            return false;
                        }
                        return equals(o1.getTime(), o2.getTime(), ignoredList, isRestricted);
                    } else if (isRegExp(o1) && isRegExp(o2)) {
                        return o1.toString() == o2.toString();
                    } else {
                        if (isScope(o1) || isScope(o2) || isWindow(o1) || isWindow(o2) || angular.isArray(o2)) {
                            return false;
                        }
                        keySet = {};
                        for (key in o1) {
                            if (ignoredList.indexOf(key) >= 0) continue;

                            if (key.charAt(0) === '$' || angular.isFunction(o1[key])) continue;
                            if (!equals(o1[key], o2[key], ignoredList, isRestricted)) {
                                return false;
                            }
                            keySet[key] = true;
                        }
                        for (key in o2) {
                            if (ignoredList.indexOf(key) >= 0) continue;

                            if (!keySet.hasOwnProperty(key) &&
                                key.charAt(0) !== '$' &&
                                o2[key] !== undefined && !angular.isFunction(o2[key])) {
                                return false;
                            }
                        }
                        return true;
                    }
                }
            }
            return false;
        }

        return exports;
    })

    .factory('changeReminder', function () {

        var exports = {
            interceptNavigation: interceptNavigation,
            interceptSignout: interceptSignout,
            onNavigateAway: onNavigateAway
        };

        var changeTrackerScopes = [];
        var _confirmationMessage = 'It looks like you have been editing something. If you leave before saving, your changes will be lost.';

        function interceptSignout(callback) {
            callback = callback || angular.noop;
            var changed = false;
            for (var i = 0; i < changeTrackerScopes.length; i += 1) {
                if (changeTrackerScopes[i].hasChanges) {
                    changed = true;
                    break;
                }
            }

            if (changed) {
                if (window.confirm(_confirmationMessage)) {
                    // set all $$dataChanged false before sign out, otherwise the reminder alert will show again.
                    for (i = 0; i < changeTrackerScopes.length; i += 1) {
                        if (changeTrackerScopes[i].hasChanges) {
                            changeTrackerScopes[i].hasChanges = false;
                        }
                    }
                    changeTrackerScopes = [];

                    callback();
                }
            } else {
                callback();
            }
        }

        function interceptNavigation(scope, confirmCallback, cancelCallback) {
            confirmCallback = confirmCallback || angular.noop;
            cancelCallback = cancelCallback || angular.noop;

            if (scope.hasChanges) {
                if (window.confirm(_confirmationMessage)) {
                    confirmCallback();
                } else if (cancelCallback) {
                    cancelCallback();
                }
            } else {
                confirmCallback();
            }
        }

        function onNavigateAway(scope) {
            var scopeIndex = changeTrackerScopes.indexOf(scope);
            if (scopeIndex === -1) {
                changeTrackerScopes.push(scope);
            }

            //state change start
            scope.$on('$stateChangeStart', function (event) {
                if (scope.hasChanges) {
                    if (!window.confirm(_confirmationMessage)) {
                        event.preventDefault();
                    }
                }
            });

            //NATIVE DOM IE9+
            function beforeUnload(e) {
                if (scope.hasChanges) {
                    (e || window.event).returnValue = _confirmationMessage;
                    return _confirmationMessage;
                }
            }

            angular.element(window).on('beforeunload', beforeUnload);

            //destroy event
            scope.$on('$destroy', function () {
                // remove scope from changeTrackerScopes
                scopeIndex = changeTrackerScopes.indexOf(scope);
                if (scopeIndex > -1) {
                    changeTrackerScopes.splice(scopeIndex, 1);
                }

                angular.element(window).off('beforeunload', beforeUnload);
            });

        }

        return exports;
    });
