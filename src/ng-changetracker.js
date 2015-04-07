(function() {
	'use strict';

	angular.module('ngChangeTracker', []).factory('ngChangeTracker', ngChangeTracker);

	function ngChangeTracker() {
		var _defaultMessage = 'If you leave this page, you will lose all changes you have made on current page.';

		var factory = {
			factory.watch: watch,
				factory.rewatch: rewatch,
				factory.reset: reset,
				factory.clear: clear,
				factory.clearAll: clearAll,
				factory.hasChanges: hasChanges,
				factory.hasChangesOnScope: hasChangesOnScope,
				factory.interceptOnScope: interceptOnScope,
				factory.intercept: intercept,
				factory.onNavigateAway: onNavigateAway
		};

		factory.scopeChangeMap = {};
		return factory;

		function watch(scope, tragets, ignored,weakCheck) {
			if (angular.isArray(tragets)) {
				for (var index in tragets) {
					var modelName = tragets[index];
					if (angular.isString(modelName)) {
						watchModel(scope, modelName, ignored,weakCheck);
					} else {
						console.log('Invalide model name:' + tragets[index]);
					}
				}
			} else if (angular.isString(tragets)) {
				watchModel(scope, tragets, ignored,weakCheck);
			} else {
				console.log('Invalide model name:' + tragets);
			}
		}

		function rewatch(scope, tragets, ignored,weakCheck) {
			clear(scope);
			watch(scope, tragets, ignoredProperties,weakCheck);
		}

		function watchModel(scope, modelName, ignored,weakCheck) {
			if (angular.isUndefined(factory.scopeChangeMap[scope.$id])) {
				factory.scopeChangeMap[scope.$id] = {
					hasChanges: false,
					scope: scope
				};
			}
			//Add a change tracker on scope 
			if (angular.isUndefined(scope.tracker)) {
				scope.tracker = {};
			}

			//Remove old watch on the tracker
			if (scope.tracker[modelName] && scope.tracker[modelName].unwatch) {
				scope.tracker[modelName].unwatch();
			}

			//Tracker model
			var modelTracker = {};
			modelTracker.original = angular.copy(evaluateModelValue(scope, modelName));
			modelTracker.hasChanges = false;
			modelTracker.unwatch = scope.$watch(modelName, function(newValue, oldValue) {
				if (newValue != oldValue) {
					var original = scope.tracker[model].original;
					var current = evaluateModelValue(scope, model);
					scope.tracker[model].hasChanges = !equals(current, original, ignored,weakCheck);
					if (scope.tracker[model].hasChanges) {
						scope.hasChanges = true;
						onScopeChanged(scope);
					} else {
						scope.hasChanges = hasChangesOnScope(scope);
						onScopeChanged(scope);
					}
				}
			}, true);
			scope.tracker[modelName] = modelTracker;

			//Set scope change status
			scope.hasChanges = hasChangesOnScope(scope);
			onScopeChanged(scope);
		}


		function evaluateModelValue(scope, modelName) {
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

		function reset() {
			scope.hasChanges = false;
			onScopeChangeTrackerChange(scope);

			angular.forEach(scope.tracker, function(value, key) {
				var current = evaluateModelValue(scope, key);
				value.original = angular.copy(current);
				value.hasChanges = false;
			});
		}

		function clear(scope) {
			scope.hasChanges = false;
			onScopeChangeTrackerChange(scope);

			angular.forEach(scope.tracker, function(value, key) {
				if (value.unwatch) {
					value.unwatch();
				}
			});
			scope.tracker = {};
		}

		function clearAll() {
			for (var scopeId in factory.scopeChangeMap) {
				var scope = scopeChangeMap[scopeId].scope
				if (scope) {
					clear(scope);
				}
			}
		}

		function hasChanges() {
			for (var scopeId in factory.scopeChangeMap) {
				if (scopeChangeMap[scopeId].hasChanges) {
					return true;
				}
			}
			return false;
		}

		function hasChangesOnScope(scope) {
			for (var modelName in scope.tracker) {
				var modelTracker = scope.tracker[modelName];
				if (modelTracker.hasChanges) {
					return true;
				}
			}
			return false;
		}

		function onScopeChanged(scope) {
			if (angular.isUndefined(factory.scopeChangeMap[scope.$id])) {
				factory.scopeChangeMap[scope.$id] = {
					hasChanges: false,
					scope: scope
				};
			}
			factory.scopeChangeMap[scope.$id].hasChanges = scope.hasChanges;
		};


		function interceptOnScope(scope, confirmCallback, cancelCallback, confirmMessage) {
			if (!confirmMessage) {
				confirmMessage = _defaultMessage;
			}

			if (scope.hasChanges) {
				if (window.confirm(confirmMessage)) {
					factory.clear(scope);
					confirmCallback();
				} else if (cancelCallback) {
					cancelCallback();
				}
			} else {
				confirmCallback();
			}
		}

		function intercept(confirmCallback, cancelCallback, confirmMessage) {
			if (!confirmMessage) {
				confirmMessage = _defaultMessage;
			}

			if (factory.hasChangesInAllScopes()) {
				if (window.confirm(confirmMessage)) {
					//clear all changes in scopes as it will log out
					clearAll();

					if (confirmCallback) {
						confirmCallback();
					}
				} else if (cancelCallback) {
					cancelCallback();
				}
			} else if (cancelCallback) {
				cancelCallback();
			}
		}

		function onNavigateAway(scope, confirmMessage) {
			if (!confirmMessage) {
				confirmMessage = _defaultMessage;
			}

			//state change start
			scope.$on('$stateChangeStart', function(event) {
				if (scope.hasChanges) {
					if (!window.confirm(confirmMessage)) {
						event.preventDefault();
					}
				}
			});

			//NATIVE DOM IE9+
			function beforeUnload(e) {
				if (scope.hasChanges) {
					(e || window.event).returnValue = confirmMessage;
					return confirmMessage;
				}
			};
			angular.element(window).on('beforeunload', beforeUnload);

			//destroy event
			scope.$on('$destroy', function() {
				delete factory.scopeChanges[scope.$id];
				angular.element(window).off('beforeunload', beforeUnload);
			});
		}


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
		function equals(o1, o2, ignored, weakCheck) {
			if (o1 === o2) return true;
			if (weakCheck) {
				if (angular.isUndefined(o1) && o2 === '') return true;
				if (angular.isUndefined(o2) && o1 === '') return true;
				if (angular.isUndefined(o1) && o2 === null) return true;
				if (angular.isUndefined(o2) && o1 === null) return true;
				if (o1 === '' && o2 === null) return true;
				if (o2 === '' && o1 === null) return true;
			}
			if (o1 === null || o2 === null) {
				console.log('o1:' + o1 + ', o2:' + o2 + ' changed');
				return false;
			}
			if (o1 !== o1 && o2 !== o2) return true; // NaN === NaN
			var t1 = typeof o1,
				t2 = typeof o2,
				length, key, keySet;

			var ignoredPropertyList = [];
			if (ignored && angular.isArray(ignored)) {
				ignoredPropertyList = ignored;
			} else if (ignored) {
				ignoredPropertyList.push(ignored);
			}

			if (t1 == t2) {
				if (t1 == 'object') {
					if (angular.isArray(o1)) {
						if (!angular.isArray(o2)) {
							console.log('o1:' + o1 + ', o2:' + o2 + ' changed');
							return false;
						}
						if ((length = o1.length) == o2.length) {
							for (key = 0; key < length; key++) {
								//ingore key
								if (ignoredPropertyList.indexOf(key) >= 0) continue;

								if (!equals(o1[key], o2[key], ignoredPropertyList)) {
									console.log('key:' + key + ',' + 'o1:' + o1[key] + ', o2:' + o2[key] + ' changed');
									return false;
								}
							}
							return true;
						}
					} else if (angular.isDate(o1)) {
						if (!angular.isDate(o2)) {
							console.log('o1:' + o1 + ', o2:' + o2 + ' changed');
							return false;
						}
						return equals(o1.getTime(), o2.getTime(), ignoredPropertyList);
					} else if (isRegExp(o1) && isRegExp(o2)) {
						return o1.toString() == o2.toString();
					} else {
						if (isScope(o1) || isScope(o2) || isWindow(o1) || isWindow(o2) || angular.isArray(o2)) {
							console.log('o1:' + o1 + ', o2:' + o2 + ' changed');
							return false;
						}
						keySet = {};
						for (key in o1) {
							if (ignoredPropertyList.indexOf(key) >= 0) continue;

							if (key.charAt(0) === '$' || angular.isFunction(o1[key])) continue;
							if (!equals(o1[key], o2[key], ignoredPropertyList)) {
								console.log('key:' + key + ',' + 'o1:' + o1[key] + ', o2:' + o2[key] + ' changed');
								return false;
							}
							keySet[key] = true;
						}
						for (key in o2) {
							if (ignoredPropertyList.indexOf(key) >= 0) continue;

							if (!keySet.hasOwnProperty(key) &&
								key.charAt(0) !== '$' &&
								o2[key] !== undefined &&
								!angular.isFunction(o2[key])) {
								console.log('key:' + key + ',' + 'o1:' + o1 + ', o2:' + o2[key] + ' changed');
								return false;
							}
						}
						return true;
					}
				}
			}
			return false;
		}

	}

})();