(function() {
	'use strict';

	angular.module('ngChangeTracker', []).factory('ngChangeTracker', ngChangeTracker);

	function ngChangeTracker() {
		var factory = {
			factory.watch: watch,
			factory.rewatch: rewatch,
			factory.reset: reset,
			factory.clear: clear,
			factory.clearAll: clearScopeChangeCache,
			factory.hasChanges: hasChanges,
			factory.hasChangesOnScope: hasChangesOnScope,
			factory.intercept: intercept,
			factory.onNavigateAway: onNavigateAway,
			factory.interceptLogout: interceptLogout,
		};

		factory.scopeChangeMap = {};
		return factory;

		function watch(scope, tragets, ignored) {
			if (angular.isArray(tragets)) {
				for (var index in tragets) {
					var modelName = tragets[index];
					if (angular.isString(modelName)) {
						watchModel(scope, modelName, ignored);
					} else {
						console.log('Invalide model name:' + tragets[index]);
					}
				}
			} else if (angular.isString(tragets)) {
				watchModel(scope, tragets, ignored);
			} else {
				console.log('Invalide model name:' + tragets);
			}
		}

		function rewatch(scope, tragets, ignored) {
			clear(scope);
			watch(scope, tragets, ignoredProperties);
		}

		function watchModel(scope, modelName, ignored) {
			if (angular.isUndefined(factory.scopeChangeMap[scope.$id])) {
				factory.scopeChangeMap[scope.$id] = {
					hasChanges: false,
					scope: scope
				};
			}
			//Define a change tracker on scope 
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
					scope.tracker[model].hasChanges = !equals(current, original, ignored);
					if (scope.tracker[model].hasChanges) {
						scope.hasChanges = true;
						onScopeChanged(scope);
					} else {
						scope.hasChanges = hasChangesOnScope(scope);
						onScopeChanged(scope);
					}
				}
			}, true);
			scope.tracker[modelName]= modelTracker;
			
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

		function intercept(scope, confirmCallback, cancelCallback) {
			if (scope.hasChanges) {
				if (window.confirm(_confirmationMessage)) {
					factory.clear(scope);
					confirmCallback();
				} else if (cancelCallback) {
					cancelCallback();
				}
			} else {
				confirmCallback();
			}
		}

		function interceptLogout() {
			if (factory.hasChangesInAllScopes()) {
				if (window.confirm(_confirmationMessage)) {
					//clear all changes in scopes as it will log out
					clearAll();
					callback();
				}
			} else {
				callback();
			}
		}

		function onNavigateAway(scope) {
			//state change start
			scope.$on('$stateChangeStart', function(event) {
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
			};
			angular.element(window).on('beforeunload', beforeUnload);

			//destroy event
			scope.$on('$destroy', function() {
				delete factory.scopeChanges[scope.$id];
				angular.element(window).off('beforeunload', beforeUnload);
			});
		}

	}

})();