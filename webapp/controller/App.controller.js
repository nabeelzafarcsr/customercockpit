sap.ui.define([
	"com/csr/customercockpit/controller/BaseController",
	"sap/ui/model/json/JSONModel"
], function(BaseController, JSONModel) {
	"use strict";

	return BaseController.extend("com.csr.customercockpit.controller.App", {

		onInit: function() {
			var oViewModel,
				fnSetAppNotBusy,
				oListSelector = this.getOwnerComponent().oListSelector,
				iOriginalBusyDelay = this.getView().getBusyIndicatorDelay();

			oViewModel = new JSONModel({
				busy: true,
				delay: 0
			});
			this.setModel(oViewModel, "appView");

			fnSetAppNotBusy = function() {
				oViewModel.setProperty("/busy", false);
				oViewModel.setProperty("/delay", iOriginalBusyDelay);
			};

			this.getOwnerComponent().getModel().metadataLoaded()
					.then(fnSetAppNotBusy);

			// Makes sure that master view is hidden in split app
			// after a new list entry has been selected.
			oListSelector.attachListSelectionChange(function () {
				this.byId("idAppControl").hideMaster();
			}, this);

			// apply content density mode to root view
			// this.getView().addStyleClass(this.getOwnerComponent().getContentDensityClass());
			this.router = sap.ui.core.UIComponent.getRouterFor(this);
			this.router.attachRoutePatternMatched(this._handleRouteMatched, this);
		},
		_handleRouteMatched: function(oEvt) {

			if (oEvt.getParameter("config").controlAggregation === "pages") {
				this.getView().byId("idAppControl").addStyleClass("zeroHeight");
				this.getView().byId("idFullWidthAppControl").removeStyleClass("zeroHeight");
			} else {
				this.getView().byId("idFullWidthAppControl").addStyleClass("zeroHeight");
				this.getView().byId("idAppControl").removeStyleClass("zeroHeight");
			}
		}

	});

});