/*global ko, Router */
(function () {
	'use strict';

	var ENTER_KEY = 13;
	var ESCAPE_KEY = 27;

	// A factory function we can use to create binding handlers for specific
	// keycodes.
	function keyhandlerBindingFactory(keyCode) {
		return {
			init: function (element, valueAccessor, allBindingsAccessor, data, bindingContext) {
				var wrappedHandler, newValueAccessor;

				// wrap the handler with a check for the enter key
				wrappedHandler = function (data, event) {
					if (event.keyCode === keyCode) {
						valueAccessor().call(this, data, event);
					}
				};

				// create a valueAccessor with the options that we would want to pass to the event binding
				newValueAccessor = function () {
					return {
						keyup: wrappedHandler
					};
				};

				ko.bindingHandlers.event.init(element, newValueAccessor, allBindingsAccessor, data, bindingContext);
			}
		};
	}

	ko.bindingHandlers.enterKey = keyhandlerBindingFactory(ENTER_KEY);

	ko.bindingHandlers.escapeKey = keyhandlerBindingFactory(ESCAPE_KEY);

	ko.bindingHandlers.selectAndFocus = {
		init: function (element, valueAccessor, allBindingsAccessor, bindingContext) {
			ko.bindingHandlers.hasFocus.init(element, valueAccessor, allBindingsAccessor, bindingContext);
			ko.utils.registerEventHandler(element, 'focus', function () {
				element.focus();
			});
		},
		update: function (element, valueAccessor) {
			ko.utils.unwrapObservable(valueAccessor()); 
			setTimeout(function () {
				ko.bindingHandlers.hasFocus.update(element, valueAccessor);
			}, 0);
		}
	};

	// represent a single plan plan
	var Plan = function (title, completed) {
		this.title = ko.observable(title);
		this.completed = ko.observable(completed);
		this.editing = ko.observable(false);
	};

	// our main view model
	var ViewModel = function (plans) {
		// map array of passed in plans to an observableArray of Plan objects
		this.plans = ko.observableArray(plans.map(function (plan) {
			return new Plan(plan.title, plan.completed);
		}));

		// store the new plan value being entered
		this.current = ko.observable();

		this.showMode = ko.observable('all');

		this.filteredPlans = ko.computed(function () {
			switch (this.showMode()) {
			case 'active':
				return this.plans().filter(function (plan) {
					return !plan.completed();
				});
			case 'completed':
				return this.plans().filter(function (plan) {
					return plan.completed();
				});
			default:
				return this.plans();
			}
		}.bind(this));

		// add a new plan, when enter key is pressed
		this.add = function () {
			var current = this.current().trim();
			if (current) {
				this.plans.push(new Plan(current));
				this.current('');
			}
		}.bind(this);

		// remove a single plan
		this.remove = function (plan) {
			this.plans.remove(plan);
		}.bind(this);

		// remove all completed plans
		this.removeCompleted = function () {
			this.plans.remove(function (plan) {
				return plan.completed();
			});
		}.bind(this);

		// edit a plan
		this.editPlan = function (plan) {
			plan.editing(true);
			plan.previousTitle = plan.title();
		}.bind(this);

		// stop editing a plan.  Remove the plan, if it is now empty
		this.saveEditing = function (plan) {
			plan.editing(false);

			var title = plan.title();
			var trimmedTitle = title.trim();

			// Observable value changes are not triggered if they're consisting of whitespaces only
			// Therefore we've to compare untrimmed version with a trimmed one to chech whether anything changed
			// And if yes, we've to set the new value manually
			if (title !== trimmedTitle) {
				plan.title(trimmedTitle);
			}

			if (!trimmedTitle) {
				this.remove(plan);
			}
		}.bind(this);

		// cancel editing an plan and revert to the previous content
		this.cancelEditing = function (plan) {
			plan.editing(false);
			plan.title(plan.previousTitle);
		}.bind(this);

		// count of all completed plans
		this.completedCount = ko.computed(function () {
			return this.plans().filter(function (plan) {
				return plan.completed();
			}).length;
		}.bind(this));

		this.remainingCount = ko.computed(function () {
			return this.plans().length - this.completedCount();
		}.bind(this));

		this.allCompleted = ko.computed({
			//always return true/false based on the done flag of all plans
			read: function () {
				return !this.remainingCount();
			}.bind(this),
			// set all plans to the written value (true/false)
			write: function (newValue) {
				this.plans().forEach(function (plan) {
					// set even if value is the same, as subscribers are not notified in that case
					plan.completed(newValue);
				});
			}.bind(this)
		});

		this.getLabel = function (count) {
			return ko.utils.unwrapObservable(count) === 1 ? 'plan' : 'plans';
		}.bind(this);

		ko.computed(function () {
			// store a clean copy to local storage, which also creates a dependency on
			// the observableArray and all observables in each plan
			localStorage.setItem('plans-knockoutjs', ko.toJSON(this.plans));
		}.bind(this)).extend({
			rateLimit: { timeout: 500, method: 'notifyWhenChangesStop' }
		}); // save at most twice per second
	};

	// check local storage for plans
	var plans = ko.utils.parseJson(localStorage.getItem('plans-knockoutjs'));

	// bind a new instance of our view model to the page
	var viewModel = new ViewModel(plans || []);
	ko.applyBindings(viewModel);

	// set up filter routing
	Router({ '/:filter': viewModel.showMode }).init();
}());
