sap.ui.define([
	"com/csr/customercockpit/controller/BaseController",
	"com/csr/customercockpit/model/formatter",
	"sap/ui/model/json/JSONModel"
], function(BaseController, formatter, JSONModel) {
	"use strict";

	return BaseController.extend("com.csr.customercockpit.controller.OrderDetails", {

		formatter: formatter,
		onInit: function() {
			var oViewModel = this.createViewModel();
			this.getView().setModel(oViewModel, "orderDetailViewModel");
			this.getOwnerComponent().getRouter().getRoute("orderDetails").attachPatternMatched(this.onObjectMatched, this);
		},
		createViewModel: function() {
			return new JSONModel({
				"delay": 0,
				"busy": false
			});
		},
		onObjectMatched : function (oEvent) {
			var oViewModel = this.getView().getModel("orderDetailViewModel");
			var changeOrderHeaderModel = this.getOwnerComponent().getModel("changeOrderHeaderModel");
			oViewModel.setProperty("/busy", true);
			this.sCustContextPath = oEvent.getParameter("arguments").custContextPath;
			this.selectedDocument = oEvent.getParameter("arguments").documentID;
			this.paymentInd = oEvent.getParameter("arguments").paymentInd;
			var itemIndex = oEvent.getParameter("arguments").itemIndex;
			var itemScheduleLines = changeOrderHeaderModel.getProperty("/ItemSet/" + itemIndex + "/SchedLineSet");
			var itemPriceConditions = changeOrderHeaderModel.getProperty("/ItemSet/" + itemIndex + "/PriceCondSet");
			var item = changeOrderHeaderModel.getProperty("/ItemSet/" + itemIndex);
			oViewModel.setProperty("/scheduleLines", itemScheduleLines);
			oViewModel.setProperty("/scheduleLinesCount", itemScheduleLines.length);
			oViewModel.setProperty("/priceConditions", itemPriceConditions);
			oViewModel.setProperty("/priceConditionsCount", itemPriceConditions.length);
			oViewModel.setProperty("/item", item);
			oViewModel.setProperty("/busy", false);
		},
		onNavBack: function() {
			this.handleCancel();
		},
		handleCancel: function() {
			this.getRouter().navTo("changeOrder", {
				documentID: this.selectedDocument,
				custContextPath: this.sCustContextPath,
				context: "orderDetails",
				paymentInd: this.paymentInd
				}, true);
		}
	});

});