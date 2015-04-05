(function() {
	'use strict';

	angular.module('ngChangeTracker', []).factory('ngChangeTracker', ngChangeTracker);

	function ngChangeTracker() {
		var factory = {
			factory.watch: watch,
			factory.rewatch: rewatch,
			factory.reset: reset,
			factory.clear: clear,
			factory.clearScopeChangeCache: clearScopeChangeCache,
			factory.hasChangesOnGlobalScope: hasChangesOnGlobalScope,
			factory.hasChangesOnScope: hasChangesOnScope,
			factory.intercept: intercept,
			factory.onNavigateAway: onNavigateAway,
			factory.interceptLogout: interceptLogout,
		};

		factory.scopeChangeCache = {};

		return factory;

		function rewatch(scope, model, ignored) {
			clear(scope);
			watch(scope, model, ignoredProperties);
		}

		function watch(scope, model, ignored) {
			if (angular.isArray(model)) {
				for (var index in model) {
					if (angular.isString(model[index])) {
						watchModel(scope, model[index], ignored);
					} else {
						console.log('Invalide model name:' + model[index]);
					}
				}
			} else if (angular.isString(model)) {
				watchModel(scope, model, ignored);
			} else {
				console.log('Invalide model name:' + model);
			}
		}

		function watchModel(scope, model, ignored) {
			if (angular.isUndefined(factory.scopeChangeCache[scope.$id])) {
				factory.scopeChangeCache[scope.$id] = {
					hasChanges: false,
					scope: scope
				};
			}

			//Define a change tracker on scope 
			if (angular.isUndefined(scope.tracker)) {
				scope.tracker = {};
			}

			//Remove old watch on the tracker
			if (scope.tracker[model] && scope.tracker[model].unwatch) {
				scope.tracker[model].unwatch();
			}

			var modelTracker = {};
			modelTracker.original = angular.copy(_getValueFromScope(scope, model));
			modelTracker.hasChanges = false;
			scope.tracker[model] = modelTracker;

			scope.hasChanges = detectScopeChanges(scope);
			_onScopeChangeTrackerChange(scope);

			scope.tracker[model].unwatch = scope.$watch(model, function(newValue, oldValue) {
				if (newValue != oldValue) {
					var originalObject = scope.tracker[model].original;
					var currentObject = _getValueFromScope(scope, model);
					scope.tracker[model].hasChanges = !equals(currentObject, originalObject, ignoredProperties);
					if (scope.tracker[model].hasChanges) {
						scope.hasChanges = true;
						_onScopeChangeTrackerChange(scope);
					} else {
						scope.hasChanges = _detectScopeChanges(scope);
						_onScopeChangeTrackerChange(scope);
					}
				}
			}, true);

		}


		function evaluateModel(scope, modelName) {
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
				var current = evaluateModel(scope, key);
				value.original = angular.copy(current);
				value.hasChanges = false;
			});
		}

		function clear() {
			scope.hasChanges = false;
			onScopeChangeTrackerChange(scope);

			angular.forEach(scope.tracker, function(value, key) {
				if (value.unwatch) {
					value.unwatch();
				}
			});
			scope.tracker = {};
		}

		function clearScopeChangeCache() {
			for (var scopeId in factory.scopeChangeCache) {
				var scope = scopeChangeCache[scopeId].scope
				if (scope) {
					clear(scope);
				}
			}
		}

		function hasChangesOnGlobalScope() {
			for (var scopeId in factory.scopeChangeCache) {
				if (scopeChangeCache[scopeId].hasChanges) {
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

		function updateScopeChangeCache(scope) {
			if (angular.isUndefined(factory.scopeChangeCache[scope.$id])) {
				factory.scopeChangeCache[scope.$id] = {
					hasChanges: false,
					scope: scope
				};
			}
			factory.scopeChangeCache[scope.$id].hasChanges = scope.hasChanges;
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
					factory.clearAllScopeChanges();
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