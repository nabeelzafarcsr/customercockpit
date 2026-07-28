/*global location */

sap.ui.define([
	"com/csr/customercockpit/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"com/csr/customercockpit/model/formatter",
	"com/csr/customercockpit/model/models",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator"
], function(BaseController, JSONModel, formatter, models, Filter, FilterOperator) {
	"use strict";

	return BaseController.extend("com.csr.customercockpit.controller.Detail", {

		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		onInit: function() {
			// Model used to manipulate control states. The chosen values make sure,
			// detail page is busy indication immediately so there is no break in
			// between the busy indication for loading the view's meta data
			var oViewModel = new JSONModel({
				busy: false,
				delay: 0,
				lineItemListTitle: this.getResourceBundle().getText("documents")
			});
			var oList = this.byId("lineItemsList");
			this._oList = oList;
			// keeps the filter and search state
			this._oListFilterState = {
				aFilter: [],
				aSearch: []
			};
			// set the DocumentListDiaolog fragment  model

			this.getRouter().getRoute("detail").attachPatternMatched(this._onObjectMatched, this);
			this.setModel(oViewModel, "detailView");
			this.getOwnerComponent().getModel().metadataLoaded().then(this._onMetadataLoaded.bind(this));
		},

		_onObjectMatched: function(oEvent) {
			var that = this;
			var changeOrderDeleteItemsModel = this.getOwnerComponent().getModel("changeOrderDeleteItemsModel");
			this.sCustContextPath = oEvent.getParameter("arguments").custContextPath;
			this.getModel().metadataLoaded().then(function() {
				that._bindView("/" + that.sCustContextPath);
			});
			
			if (that.getModel().getProperty("/" + this.sCustContextPath) !== undefined) {
				that.custId = that.getModel().getProperty("/" + this.sCustContextPath).CustomerId;
				that.setCustomerStatusIcon(that.getModel().getProperty("/" + this.sCustContextPath));
				if (that.custId) {
					that.serviceCallforCustomerLineItems(that.custId);
				}
			}
			this.getView().byId("detailSearchField").setValue(null);
			changeOrderDeleteItemsModel.setProperty("/ItemSet", null);
		},

		onSearch: function(oEvent) {
			if (oEvent.getParameters().refreshButtonPressed) {
				this.onRefresh();
				return;
			}
			var customerId = this.getModel().getProperty("/" + this.sCustContextPath).CustomerId;
			var sQuery = oEvent.getParameter("query");
			if (sQuery) {
				this._oListFilterState.aSearch = [(new Filter("CustomerId", FilterOperator.EQ, customerId)), (new Filter("CustomerPo",
					FilterOperator.EQ, sQuery))];
			} else {
				this._oListFilterState.aSearch = [(new Filter("CustomerId", FilterOperator.EQ, customerId))];
			}
			this._applyFilterSearch();

		},

		/**
		 * Event handler for refresh event. Keeps filter, sort
		 * and group settings and refreshes the list binding.
		 * @public
		 */
		onRefresh: function() {
			this._oList.getBinding("items").refresh();
		},

		/**
		 * Internal helper method to apply both filter and search state together on the list binding
		 * @private
		 */
		_applyFilterSearch: function() {
			var aFilters = this._oListFilterState.aSearch.concat(this._oListFilterState.aFilter);
			var oFilter = new sap.ui.model.Filter(aFilters, true); //False means it will apply an OR logic, if you want AND pass true
			var oViewModel = this.getModel("detailView");
			this._oList.getBinding("items").filter(oFilter, "Application");
			// changes the noDataText of the list in case there are no filter results
			if (aFilters.length !== 0) {
				oViewModel.setProperty("/noDataText", this.getResourceBundle().getText("masterListNoDataWithFilterOrSearchText"));
			} else if (this._oListFilterState.aSearch.length > 0) {
				// only reset the no data text to default when no new search was triggered
				oViewModel.setProperty("/noDataText", this.getResourceBundle().getText("masterListNoDataText"));
			}
		},
		onShareEmailPress: function() {
			var oViewModel = this.getModel("detailView");

			sap.m.URLHelper.triggerEmail(
				null,
				oViewModel.getProperty("/shareSendEmailSubject"),
				oViewModel.getProperty("/shareSendEmailMessage")
			);
		},

		/**
		 * Event handler when the share in JAM button has been clicked
		 * @public
		 */
		onShareInJamPress: function() {
			var oViewModel = this.getModel("detailView"),
				oShareDialog = sap.ui.getCore().createComponent({
					name: "sap.collaboration.components.fiori.sharing.dialog",
					settings: {
						object: {
							id: location.href,
							share: oViewModel.getProperty("/shareOnJamTitle")
						}
					}
				});

			oShareDialog.open();
		},

		/**
		 * Updates the item count within the line item table's header
		 * @param {object} oEvent an event containing the total number of items in the list
		 * @private
		 */
		onUpdateFinished: function(oEvent) {
			var sTitle,
				iTotalItems = oEvent.getParameter("total"),
				oViewModel = this.getModel("detailView");

			// only update the counter if the length is final
			if (this.byId("lineItemsList").getBinding("items").isLengthFinal()) {
				if (iTotalItems) {
					sTitle = this.getResourceBundle().getText("documentsCount", [iTotalItems]);
				} else {
					//Display 'Line Items' instead of 'Line items (0)'
					sTitle = this.getResourceBundle().getText("documents");
				}
				oViewModel.setProperty("/documentsCount", sTitle);
			}
		},

		/* =========================================================== */
		/* begin: internal methods                                     */
		/* =========================================================== */

		/**
		 * Binds the view to the object path. Makes sure that detail view displays
		 * a busy indicator while data for the corresponding element binding is loaded.
		 * @function
		 * @param {string} sObjectPath path to the object to be bound to the view.
		 * @private
		 */
		_bindView: function(sObjectPath) {
			// Set busy indicator during view binding
			var oViewModel = this.getModel("detailView");
			var that = this;
			// If the view was not bound yet its not busy, only if the binding requests data it is set to busy again
			oViewModel.setProperty("/busy", false);
			var oPage = this.getView().byId("csrDetailPageId");
			oPage.setVisible(true);
			this.getView().bindElement({
				path: sObjectPath,
				events: {
					change: this._onBindingChange.bind(this),
					dataRequested: function() {
						oViewModel.setProperty("/busy", true);
					},
					dataReceived: function() {
						oViewModel.setProperty("/busy", false);
						if (that.getModel().getProperty(sObjectPath) !== undefined) {
							var custId = that.getModel().getProperty(sObjectPath).CustomerId;
							if (custId) {
								that.setCustomerStatusIcon(that.getModel().getProperty(sObjectPath));
								that.serviceCallforCustomerLineItems(custId);
							}
						}
					}
				}
			});
		},

		_onBindingChange: function() {
			var oView = this.getView(),
				oElementBinding = oView.getElementBinding();

			// No data for the binding
			if (!oElementBinding.getBoundContext()) {
				this.getRouter().getTargets().display("detailObjectNotFound");
				// if object could not be found, the selection in the master list
				// does not make sense anymore.
				this.getOwnerComponent().oListSelector.clearMasterListSelection();
				return;
			}

			var sPath = oElementBinding.getPath();
			var sObjectId = null;
			var sObjectName = null;
			var oResourceBundle = this.getResourceBundle();
			var oObject = oView.getModel().getObject(sPath);
			if (oObject) {
				sObjectId = oObject.CustomerId;
				sObjectName = oObject.CustomerId;
			}

			var oViewModel = this.getModel("detailView");

			this.getOwnerComponent().oListSelector.selectAListItem(sPath);

			oViewModel.setProperty("/saveAsTileTitle", oResourceBundle.getText("shareSaveTileAppTitle", [sObjectName]));
			oViewModel.setProperty("/shareOnJamTitle", sObjectName);
			oViewModel.setProperty("/shareSendEmailSubject",
				oResourceBundle.getText("shareSendEmailObjectSubject", [sObjectId]));
			oViewModel.setProperty("/shareSendEmailMessage",
				oResourceBundle.getText("shareSendEmailObjectMessage", [sObjectName, sObjectId, location.href]));
		},

		_onMetadataLoaded: function() {
			// Store original busy indicator delay for the detail view
			//var iOriginalViewBusyDelay = this.getView().getBusyIndicatorDelay();
			var	oViewModel = this.getModel("detailView"),
				oLineItemTable = this.byId("lineItemsList"),
				iOriginalLineItemTableBusyDelay = oLineItemTable.getBusyIndicatorDelay();

			// Make sure busy indicator is displayed immediately when
			// detail view is displayed for the first time
			oViewModel.setProperty("/delay", 0);
			oViewModel.setProperty("/lineItemTableDelay", 0);

			oLineItemTable.attachEventOnce("updateFinished", function() {
				// Restore original busy indicator delay for line item table
				oViewModel.setProperty("/lineItemTableDelay", iOriginalLineItemTableBusyDelay);
			});

			// Binding the view will set it to not busy - so the view is always busy if it is not bound
			oViewModel.setProperty("/busy", true);
			// Restore original busy indicator delay for the detail view
			oViewModel.setProperty("/delay", iOriginalLineItemTableBusyDelay);
		},
		onAfterRendering: function () {
			var oThis = this;
			sap.ui.Device.orientation.attachHandler(function () {
				oThis.handleOrientationChanges();
				}
			);
			if(sap.ui.Device.orientation.portrait){
    			sap.m.MessageBox.show(this.getResourceBundle().getText("orientationMsg"),sap.m.MessageBox.Icon.INFORMATION );
    		}
		},
		handleOrientationChanges: function () {
			if(sap.ui.Device.orientation.portrait){
    			sap.m.MessageBox.show(this.getResourceBundle().getText("orientationMsg"),sap.m.MessageBox.Icon.INFORMATION );
    		}
		},
		handleDocumnetIdPressed: function(oEvent) {
			var oBindingPath = oEvent.getSource().getBindingContext().sPath;
			var oObject = this.getModel().getProperty(oBindingPath);
			this.selectedDocument = oObject.OrderNo;
			this.dueAmount = oObject.NetAmount;
			this.getOrderTypeForRO(oObject.OrderType);
			//var paymentTerm = this.getModel().getProperty("/" + this.sCustContextPath).PaymentTermCode;
			if (oObject.Payment === "X") {
				this.isPaymentPaid = true;
			} else {
				this.isPaymentPaid = false;
			}
			//var orderType = oObject.OrderType;
			var paidFullAmount = oObject.Zzpaidfull;
			var status = oObject.Gbstk;
			// create popover
			if (!this._oPopover) {
				this._oPopover = sap.ui.xmlfragment("com.csr.customercockpit.view.fragment.DocumentListDialog", this);
				this.getView().addDependent(this._oPopover);
			}
			var oDocIdLink = oEvent.getSource();
			jQuery.sap.delayedCall(0, this, function() {
				this._oPopover.openBy(oDocIdLink);
			});
			/*if (orderType === "YOR" && (paymentTerm === "CASH" || paymentTerm === "COD") && paidFullAmount !== "X") {
				this.setModel(models.createDocumentListDialogModel.apply(this, [orderType]), "docListDialog");
			} else {
				this.setModel(models.createEditDocumentFlowDialogModel.apply(this, [orderType]), "docListDialog");
			}*/
			this.setModel(models.createDocumentDialogModel.apply(this, [this.isPaymentPaid, paidFullAmount, status]), "docListDialog");
		},
		
		getOrderTypeForRO:function(sOrderType){
			var oModel = this.getView().getModel("orderReturnModel");
			oModel.setProperty("/orderType",sOrderType);
		},
		
		handlePopoverList: function(oEvent) {
			var oBindingPath = oEvent.getSource().getBindingContextPath();
			var oActionKey = this.getModel("docListDialog").getProperty(oBindingPath).key;
			switch (oActionKey) {
				case "EDIT":
					{
						this.getRouter().navTo("changeOrder", {
							documentID: this.selectedDocument,
							custContextPath: this.sCustContextPath,
							paymentInd:this.isPaymentPaid
						}, true);
					}
					break;
				case "REC_PAY":
					{
						this.getRouter().navTo("payment", {
							documentID: this.selectedDocument,
							custContextPath: this.sCustContextPath,
							query: {
								action: "receivePayment",
								dueAmount: this.dueAmount
							}
						}, true);
					}
					break;
				case "DOC_FLOW":
					{
						this.getRouter().navTo("documentFlow", {
							documentID: this.selectedDocument,
							custContextPath: this.sCustContextPath
						}, true);
					}
					break;
				default:
					break;
			}

		},

		serviceCallforCustomerLineItems: function(sCustId) {
			var that = this;
			var oFilter = new sap.ui.model.Filter("CustomerId", sap.ui.model.FilterOperator.EQ, sCustId);
			var oItemsList = this.getView().byId("lineItemsList");
			var oTemplate = formatter.templateForDocLineItems(that);
			oItemsList.bindItems({
				path: "/CustomerOdersSet",
				template: oTemplate,
				filters: oFilter
			});
		},

		setCustomerStatusIcon: function(oCustomerObj) {
			formatter.checkVisibilityBillingIcon(oCustomerObj.Billingblockcode,this);
			formatter.checkVisibilityForClubGyprockIcon(oCustomerObj,this);
			formatter.checkVisibilityPaymentTermIcon(oCustomerObj.PaymentTermCode,this);
			formatter.checkVisibilityDeliveryIcon(oCustomerObj.Deliveryblockcode,this);
		}

	});

});