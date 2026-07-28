sap.ui.define([
	"sap/ui/base/Object",
	"sap/ui/model/Sorter"
], function(BaseObject, Sorter) {
	"use strict";

	return BaseObject.extend("com.csr.customercockpit.model.GroupSortState", {
		constructor: function(oViewModel, fnGroupFunction) {
			this._oViewModel = oViewModel;
			this._fnGroupFunction = fnGroupFunction;
		},

		sort: function(sKey) {
			var sGroupedBy = this._oViewModel.getProperty("/groupBy");
			if (sGroupedBy !== "None") {
				// If the list is grouped, remove the grouping since the user wants to sort by something different
				// Grouping only works if the list is primary sorted by the grouping - the first sorten contains a grouper function
				this._oViewModel.setProperty("/groupBy", "None");
			}
			return [new Sorter(sKey, false)];
		},

		group: function(sKey) {
			var aSorters = [];
			if (sKey === "City1") {
				// Grouping means sorting so we set the select to the same Entity used for grouping
				this._oViewModel.setProperty("/sortBy", "City1");
				aSorters.push(
					new Sorter("City1", false,
						this._fnGroupFunction.bind(this))
				);
			} else if (sKey === "None") {
				// select the default sorting again
				this._oViewModel.setProperty("/sortBy", "Erdate");
			}

			return aSorters;
		}

	});
});