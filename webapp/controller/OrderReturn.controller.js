/** Change History
 * Date          Incident      Author   Description
 * --------     -----------  ---------  -------------------
 *30/10/2017    517250/2017   I327900   Return Order reason is not saved
 *04/10/2018    179485/2018   C5253525  ePOS-Return Order-Reason for Return
 */

sap.ui.define([
	"com/csr/customercockpit/controller/BaseController",
	"com/csr/customercockpit/model/formatter",
	"com/csr/customercockpit/model/models",
	"sap/ui/model/json/JSONModel"
], function(BaseController, formatter, models, JSONModel) {
	"use strict";

	return BaseController.extend("com.csr.customercockpit.controller.OrderReturn", {

		formatter: formatter,
		onInit: function() {
			var oViewModel = this.createViewModel();
			this.getView().setModel(oViewModel, "orderReturnViewModel");
			this.getRouter().getRoute("orderReturn").attachPatternMatched(this._onObjectMatched, this);
		},
		createViewModel: function() {
			return new JSONModel({
				"delay": 0,
				"busy": false
			});
		},
		
		onAfterRendering: function(){
			this.getView().byId("idReturn").setEnabled(true);
		},

		_onObjectMatched: function(oEvent) {
			this.getView().byId("idReturn").setEnabled(true);
			var oViewModel = this.getView().getModel("orderReturnViewModel");
			var orderReturnModel = this.getOwnerComponent().getModel("orderReturnModel");
			oViewModel.setProperty("/busy", true);
			this.sCustContextPath = oEvent.getParameter("arguments").custContextPath;
			var selectedInvoice = oEvent.getParameter("arguments").invoiceID;
			this.selectedInvoice = selectedInvoice;
			var context = oEvent.getParameter("arguments").context;
			this.documentID = oEvent.getParameter("arguments").documentID;
			var oItems = this.getView().byId("returnOrderItems");

			if (!context) {
				if (oItems) {
					oItems.removeSelections(true);
				}
				this.getOwnerComponent().setModel(models.createOrderReturnModel(), "orderReturnModel");
				this.triggerGetInvoiceDetails(selectedInvoice);
			} else {
				oViewModel.setProperty("/busy", false);
			}
			orderReturnModel.setProperty("/invoiceID", selectedInvoice);

		},
		onQuantityChange: function(oEvent) {
			var orderReturnModel = this.getOwnerComponent().getModel("orderReturnModel");
			var itemPath = oEvent.getSource().getParent().getBindingContext("orderReturnModel").sPath;
			var orderQuantity = orderReturnModel.getProperty(itemPath + "/OrderQty");
			var quantity = orderReturnModel.getProperty(itemPath + "/Qty");

			if (!orderQuantity || parseInt(orderQuantity) <= 0 || parseInt(orderQuantity) > parseInt(quantity)) {
				orderReturnModel.setProperty(itemPath + "/quantityShowValueStateMessage", true);
				orderReturnModel.setProperty(itemPath + "/quantityValueState", "Error");
				return false;
			} else {
				orderReturnModel.setProperty(itemPath + "/quantityShowValueStateMessage", false);
				orderReturnModel.setProperty(itemPath + "/quantityValueState", "None");

				return true;
			}

		},
		onBlockPress: function(oEvent) {
			var orderReturnModel = this.getOwnerComponent().getModel("orderReturnModel");
			var itemPath = oEvent.getSource().getParent().getBindingContext('orderReturnModel').sPath;
			orderReturnModel.setProperty(itemPath + "/IsBlocked", "X");
		},
		onSalePress: function(oEvent) {
			var orderReturnModel = this.getOwnerComponent().getModel("orderReturnModel");
			var itemPath = oEvent.getSource().getParent().getBindingContext('orderReturnModel').sPath;
			orderReturnModel.setProperty(itemPath + "/IsBlocked", "");
		},
		triggerGetInvoiceDetails: function(invoiceID) {
			var oThis = this;
			var oModel = this.getModel();
			var invoiceRequest = {};
			invoiceRequest.SalesOrderTypeCode = "YIR";
			invoiceRequest.VbelnRef = invoiceID;
			invoiceRequest.Simul = "X";
			invoiceRequest.ItemSet = [];
			invoiceRequest.HeaderPartnerSet = [];

			oModel.create("/HeaderSet", invoiceRequest, {
				success: function(data) {
					data.VbelnRef = invoiceID;
					oThis.onGetInvoiceDeailsSuccessCallback(data);
				},
				error: function(error) {
					oThis.onGetInvoiceDeailsErrorCallback(error);
				}
			});
		},
		onGetInvoiceDeailsSuccessCallback: function(data) {
			var oViewModel = this.getView().getModel("orderReturnViewModel");
			var orderReturnModel = this.getOwnerComponent().getModel("orderReturnModel");
			orderReturnModel.setProperty("/TotalAmount", data.TotalAmount);
			orderReturnModel.setProperty("/DocumentCurrency", data.DocumentCurrency);
			orderReturnModel.setProperty("/SalesOrderTypeCode", data.SalesOrderTypeCode);
			orderReturnModel.setProperty("/SalesOrderTypeDescr", data.SalesOrderTypeDescr);
			orderReturnModel.setProperty("/SoldToPartyID", data.SoldToPartyID);
			orderReturnModel.setProperty("/SoldToPartyDescr", data.SoldToPartyDescr);
			orderReturnModel.setProperty("/SalesOrganization", data.SalesOrganization);
			orderReturnModel.setProperty("/DistributionChannel", data.DistributionChannel);
			orderReturnModel.setProperty("/Division", data.Division);
			orderReturnModel.setProperty("/PaymentTermCode", data.PaymentTermCode);
			orderReturnModel.setProperty("/PurchaseOrderNumber", data.PurchaseOrderNumber);
			orderReturnModel.setProperty("/invoiceID", data.VbelnRef);

			this.updateItems(data);
			this.updateHeaderPartners(data);

			oViewModel.setProperty("/busy", false);
		},
		onGetInvoiceDeailsErrorCallback: function(error) {
			var oViewModel = this.getView().getModel("orderReturnViewModel");
			oViewModel.setProperty("/busy", false);
			var errorResponse = JSON.parse(error.responseText);
			var errorMessage = errorResponse.error.message.value;
			sap.m.MessageToast.show(
				errorMessage, {
					duration: 6000
				});
		},
		updateItems: function(data) {
			var orderReturnModel = this.getOwnerComponent().getModel("orderReturnModel");
			var invoiceItemSet = [];
			var itemSet;
			var itemCount;
			var item;
			var invoiceItem;
			if (data.ItemSet && data.ItemSet.results) {
				itemSet = data.ItemSet.results;
				itemCount = itemSet.length;

				for (var itemIndex = 0; itemIndex < itemCount; itemIndex++) {
					item = itemSet[itemIndex];
					invoiceItem = {};
					invoiceItem = item;
					invoiceItem.IsBlocked = "X";
					invoiceItem.OrderQty = item.OrderQty;
					invoiceItem.Qty = item.OrderQty;
					invoiceItem.Is3rdParty = !!invoiceItem.Is3rdParty;         //Changes by I561959 - Fix for UI upgrade
					invoiceItemSet.push(invoiceItem);
				}
				orderReturnModel.setProperty("/ItemSet", invoiceItemSet);

			}
		},
		updateHeaderPartners: function(data) {
			var orderReturnModel = this.getOwnerComponent().getModel("orderReturnModel");
			var isBMPartnerRead = false;
			var isPEPartnerRead = false;
			var HeaderPartnerSet = [];
			var partnerSet;
			var partnerCount;
			var partner;
			var peParnterCustomerID;
			var bmPartner;
			if (data.HeaderPartnerSet && data.HeaderPartnerSet.results) {
				partnerSet = data.HeaderPartnerSet.results;
				partnerCount = partnerSet.length;

				for (var partnerIndex = 0; partnerIndex < partnerCount; partnerIndex++) {
					partner = partnerSet[partnerIndex];
					if (partner.PartnerFunctionCode === "YA") {
						orderReturnModel.setProperty("/bmPartner", partner);
						isBMPartnerRead = true;
					} else if (partner.PartnerFunctionCode === "PE") {
						orderReturnModel.setProperty("/pePartnerCustomerID", partner.CustomerID);
						isPEPartnerRead = true;
						HeaderPartnerSet.push(partner);
					} else {
						HeaderPartnerSet.push(partner);
					}

					if (isBMPartnerRead && isPEPartnerRead) {
						break;
					}
				}
				peParnterCustomerID = orderReturnModel.getProperty("/pePartnerCustomerID");
				bmPartner = orderReturnModel.getProperty("/bmPartner");
				bmPartner.CustomerID = peParnterCustomerID;
				HeaderPartnerSet.push(bmPartner);
				orderReturnModel.setProperty("/HeaderPartnerSet", HeaderPartnerSet);
			}
		},
		rowSelectionChanged: function() {
			var orderReturnViewModel = this.getView().getModel("orderReturnViewModel");
			var oItems = this.getView().byId("returnOrderItems");
			var selectedItems = oItems.getSelectedItems();
			var selectedItemCount = selectedItems.length;
			orderReturnViewModel.setProperty("/selectedCount", selectedItemCount);
		},
		handleBack: function() {
			this.getRouter().navTo("documentFlow", {
				documentID: this.documentID,
				custContextPath: this.sCustContextPath
			}, true);
		},
		handleCancel: function() {
			var oInitialViewModel = this.createViewModel();
			this.getRouter().navTo("documentFlow", {
				documentID: this.documentID,
				custContextPath: this.sCustContextPath
			}, true);

			this.getView().setModel(oInitialViewModel, "orderReturnViewModel");
		},
		onUpdateFinished: function() {
			var orderReturnViewModel = this.getView().getModel("orderReturnViewModel");
			var oItems = this.getView().byId("returnOrderItems");
			var selectedItems = oItems.getSelectedItems();
			var selectedItemCount = selectedItems.length;
			orderReturnViewModel.setProperty("/selectedCount", selectedItemCount);
		},
		handleReturnOrder: function() {
			var oViewModel = this.getView().getModel("orderReturnViewModel");
		//	oViewModel.setProperty("/busy", true);//Commented by C5253525 #179485/2018/ePOS-Return Order-Reason for Return
			var orderReturnModel = this.getOwnerComponent().getModel("orderReturnModel");
			// Start of changes by C5253525 #179485/2018/ePOS-Return Order-Reason for Return
			var returningReason = orderReturnModel.getProperty("/returningReason");
			if (returningReason === "" || returningReason === undefined) {
				var msg = "Please select a Valid Reason for Return";
				sap.m.MessageToast.show(msg);
				returningReason = "00";
			}
			// End of changes by C5253525 #179485 / 2018 / ePOS - Return Order - Reason for Return
			var oItems = this.getView().byId("returnOrderItems");
			var selectedItems = oItems.getSelectedItems();
			var itemCount = selectedItems.length;
			var sItemPath;
			var item;
			if (returningReason !== "00" ){ //Added by C5253525-#179485/2018/ePOS-Return Order-Reason for Return
			if (itemCount >= 1) {
				for (var itemIndex = 0; itemIndex < itemCount; itemIndex++) {
					sItemPath = selectedItems[itemIndex].getBindingContextPath();
					item = orderReturnModel.getProperty(sItemPath);
					if (item.quantityValueState === "Error") {
						oViewModel.setProperty("/busy", false);
						sap.m.MessageToast.show(
							this.getResourceBundle().getText("resolveErrors"), {
								duration: 6000
							});
						return;
					}
				}
				oViewModel.setProperty("/busy", true);//Added by C5253525-#179485/2018/ePOS-Return Order-Reason for Return
				this.triggerReturnOrderSimulate();
			} else {
				oViewModel.setProperty("/busy", false);
				sap.m.MessageToast.show(
					this.getResourceBundle().getText("itemSelectionIssue"), {
						duration: 6000
					});
			}
							}//Added by #179485/2018/ePOS-Return Order-Reason for Return
		},
		updateReturnOrderModel: function() {
			var oItems = this.getView().byId("returnOrderItems");
			var orderReturnModel = this.getOwnerComponent().getModel("orderReturnModel");
			var orderReturnViewModel = this.getView().getModel("orderReturnViewModel");
			var returnDate = orderReturnModel.getProperty("/returnDate");
			var items = oItems.getItems();
			var selectedItems = oItems.getSelectedItems();
			var itemCount = items.length;
			var itemSet = [];
			var sItemPath;
			var item;

			if (selectedItems.length >= 1) {
				for (var itemIndex = 0; itemIndex < itemCount; itemIndex++) {
					sItemPath = items[itemIndex].getBindingContextPath();
					item = orderReturnModel.getProperty(sItemPath);
					if (item.quantityValueState === "Error") {
						orderReturnViewModel.setProperty("/busy", false);
						sap.m.MessageToast.show(
							this.getResourceBundle().getText("resolveErrors"), {
								duration: 6000
							});
						return;
					}
					item.CreatedOnDate = undefined;
					item.Qty = undefined;
					item.quantityShowValueStateMessage = undefined;
					item.quantityValueState = undefined;
					item.RequestedDeliveryDate = this.formatter.formatDate(returnDate);
					if (!items[itemIndex].getProperty("selected")) {
						item.Updkz = "D";
					}
					itemSet.push(item);
				}
				orderReturnModel.setProperty("/ItemSet", itemSet);
				this.triggerReturnOrderSimulate();

			} else {
				orderReturnViewModel.setProperty("/busy", false);
				sap.m.MessageToast.show(
					this.getResourceBundle().getText("itemSelectionIssue"), {
						duration: 6000
					});
			}
		},

		createItemSetForReturnOrder: function() {
			var oItems = this.getView().byId("returnOrderItems");
			var orderReturnModel = this.getOwnerComponent().getModel("orderReturnModel");
			var items = oItems.getItems();
			var itemCount = items.length;
			var itemSet = [];
			var sItemPath;
			var item;
			var returnOrderItem;
			var returnDate = orderReturnModel.getProperty("/returnDate");
			for (var itemIndex = 0; itemIndex < itemCount; itemIndex++) {
				sItemPath = items[itemIndex].getBindingContextPath();
				item = orderReturnModel.getProperty(sItemPath);
				returnOrderItem = JSON.parse(JSON.stringify(item));

				returnOrderItem.CreatedOnDate = undefined;
				returnOrderItem.Qty = undefined;
				returnOrderItem.quantityShowValueStateMessage = undefined;
				returnOrderItem.quantityValueState = undefined;
				returnOrderItem.RequestedDeliveryDate = this.formatter.formatDate(returnDate);
				if (!items[itemIndex].getProperty("selected")) {
					returnOrderItem.Updkz = "D";
				}
				returnOrderItem.Is3rdParty = returnOrderItem.Is3rdParty ? "X" : "";             //Changes by I561959 - Fix for UI upgrade
				
				itemSet.push(returnOrderItem);
			}
			orderReturnModel.setProperty("/ReqItemSet", itemSet);
		},

		triggerReturnOrderSimulate: function() {
			var oThis = this;
			var oModel = this.getModel();
			var orderReturnModel = this.getOwnerComponent().getModel("orderReturnModel");
			var returnOrderRequest = {};
			var invoiceID = orderReturnModel.getProperty("/invoiceID");
			var documentCurrency = orderReturnModel.getProperty("/DocumentCurrency");
			var soldToParty = orderReturnModel.getProperty("/SoldToPartyID");
			var salesOrg = orderReturnModel.getProperty("/SalesOrganization");
			var distributionChannel = orderReturnModel.getProperty("/DistributionChannel");
			var division = orderReturnModel.getProperty("/Division");
			var paymentTermCode = orderReturnModel.getProperty("/PaymentTermCode");
			var purchaseOrderNo = orderReturnModel.getProperty("/PurchaseOrderNumber");
			var headerPartnerSet = orderReturnModel.getProperty("/HeaderPartnerSet");
			var returningReason = orderReturnModel.getProperty("/returningReason");
			//Start of Commenting by C5253525-#179485/2018/ePOS-Return Order-Reason for Return
			//Start of addition by i327900 for #517250
			// if (returningReason === "" || returningReason === undefined) {
			// 	returningReason = "21";
			// 	orderReturnModel.setProperty("/returningReason", returningReason);
			// }
			//End of addition by i327900 for #517250
			//End of Commenting by C5253525-#179485/2018/ePOS-Return Order-Reason for Return
			var itemSet;
			invoiceID = this.selectedInvoice;
			this.createItemSetForReturnOrder();
			itemSet = orderReturnModel.getProperty("/ReqItemSet");
			returnOrderRequest.DocumentCurrency = documentCurrency;
			returnOrderRequest.SoldToPartyID = soldToParty;
			returnOrderRequest.SalesOrganization = salesOrg;
			returnOrderRequest.DistributionChannel = distributionChannel;
			returnOrderRequest.Division = division;
			returnOrderRequest.PaymentTermCode = paymentTermCode;
			returnOrderRequest.PurchaseOrderNumber = purchaseOrderNo;
			if (paymentTermCode === "CASH" || paymentTermCode === "COD") {
				returnOrderRequest.Simul = "X";
			}
			returnOrderRequest.SalesOrderTypeCode = "YIR";
			returnOrderRequest.VbelnRef = invoiceID;
			returnOrderRequest.Augru = returningReason;
			returnOrderRequest.HeaderPartnerSet = headerPartnerSet;

			returnOrderRequest.ItemSet = itemSet;

			oModel.setUseBatch(false);
			
			oModel.create("/HeaderSet", returnOrderRequest, {
				success: function(data) {
					oThis.getView().byId("idReturn").setEnabled(false);
					oThis.onReturnOrderSuccessCallback(data);
				},
				error: function(error) {
					oThis.onReturnOrderErrorCallback(error);
				}
			});

		},
		onReturnOrderSuccessCallback: function(data) {
			var paymentTermCode = data.PaymentTermCode;
			var oModel = this.getModel();
			var oViewModel = this.getView().getModel("orderReturnViewModel");
			var orderReturnModel = this.getOwnerComponent().getModel("orderReturnModel");
			var invoiceID = orderReturnModel.getProperty("/invoiceID");
			invoiceID = this.selectedInvoice;
			var returnOrderedAmount = data.TotalAmount;
			var salesOrderID = data.SalesOrderID;
			if (paymentTermCode === "COD" || paymentTermCode === "CASH") {
				this.getRouter().navTo("payment", {
					documentID: this.documentID,
					custContextPath: this.sCustContextPath,
					query: {
						action: "returnOrder",
						invoiceID: invoiceID,
						returnOrderedAmount: returnOrderedAmount
					}
				}, true);
			} else {
				sap.m.MessageToast.show(
					this.getResourceBundle().getText("returnOrderCreated", [salesOrderID]), {
						duration: 6000
					});

				jQuery.sap.delayedCall(100, this, function() {
					this.handleCancel();
				});

			}
			oViewModel.setProperty("/busy", false);
			oModel.setUseBatch(true);
		},
		onReturnOrderErrorCallback: function(error) {
			var oViewModel = this.getView().getModel("orderReturnViewModel");
			oViewModel.setProperty("/busy", false);
			var errorResponse = JSON.parse(error.responseText);
			var errorMessage = errorResponse.error.message.value;
			sap.m.MessageToast.show(
				errorMessage, {
					duration: 6000
				});
		}
	});

});