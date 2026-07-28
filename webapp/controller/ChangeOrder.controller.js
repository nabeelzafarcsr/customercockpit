sap.ui.define([
		"com/csr/customercockpit/controller/BaseController",
		"com/csr/customercockpit/model/formatter",
		"com/csr/customercockpit/util/OrderServiceUtil",
		"sap/ui/model/json/JSONModel",
		"sap/ui/model/FilterOperator",
		"sap/m/MessageBox"
	], function (BaseController, formatter, OrderServiceUtil, JSONModel, FilterOperator, MessageBox) {
		"use strict";

		return BaseController.extend("com.csr.customercockpit.controller.ChangeOrder", {

			formatter: formatter,
			OrderServiceUtil: OrderServiceUtil,
			onInit : function () {
				var oViewModel = this.createViewModel();
				this.getView().setModel(oViewModel, "changeOrderViewModel");
				var today = new Date();
    			var minDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    			this.getView().getModel("changeOrderViewModel").setProperty("/minDate", minDate);
				this.getRouter().getRoute("changeOrder").attachPatternMatched(this._onObjectMatched, this);
			},
			
			_onObjectMatched:function(oEvent){
				var oViewModel = this.getView().getModel("changeOrderViewModel");
				oViewModel.setProperty("/busy", true);
				this.sCustContextPath = oEvent.getParameter("arguments").custContextPath;
				var paymentInd = oEvent.getParameter("arguments").paymentInd;
				var selectedDocument = oEvent.getParameter("arguments").documentID;
				var isPORequired = this.getModel().getProperty("/" + this.sCustContextPath).Katr1;
				var context = oEvent.getParameter("arguments").context;
				oViewModel.setProperty("/salesOrderID", selectedDocument);
				oViewModel.setProperty("/isPORequired", isPORequired);
				oViewModel.setProperty("/paymentInd", paymentInd);
				if (!context) {
					this.triggerGetOrderDetails(selectedDocument);
				} else {
					oViewModel.setProperty("/busy", false);
				}
				
			},
			createViewModel: function() {
				return new JSONModel({
					"delay": 0,
					"busy": false,
					"isValidLineItemAmt": true
				});
			},
			validateCustomerPO: function () {
				var oViewModel = this.getView().getModel("changeOrderViewModel");
				var changeOrderHeaderModel = this.getOwnerComponent().getModel("changeOrderHeaderModel");
				var customerPONo = changeOrderHeaderModel.getProperty("/customerPO");
				var customerPORequired = oViewModel.getProperty("/isPORequired");
				
				if (customerPORequired === "Y" && customerPONo) {
					oViewModel.setProperty("/customerPOShowValueStateMessage", false);
					oViewModel.setProperty("/customerPOValueState", "None");
					return true;
				} else if (customerPORequired === "Y" && !customerPONo) {
					oViewModel.setProperty("/customerPOShowValueStateMessage", true);
					oViewModel.setProperty("/customerPOValueState", "Error");
					return false;
				} else {
					oViewModel.setProperty("/customerPOShowValueStateMessage", false);
					oViewModel.setProperty("/customerPOValueState", "None");
					return true;
				}
			},
			triggerGetOrderDetails : function (selectedDocument) {
				
				var oThis = this;
				var oModel = this.getModel();
				oModel.read("/HeaderSet('"+selectedDocument+"')", 
				{
					urlParameters: {
						"$expand": "HeaderPartnerSet,HeaderStatus,ItemSet,ItemSet/ItemStatus,ItemSet/PriceCondSet,ItemSet/SchedLineSet"
					},
					success: function (data) {
						oThis.onSuccessGetOrderDetails(data);
					}, 
					error: function (error) {
						oThis.onErrorGetOrderDetails(error);
					}
				});
			},
			onSuccessGetOrderDetails: function (data) {
				this.updateOrderDetails(data, true);
				var oViewModel = this.getView().getModel("changeOrderViewModel");
				oViewModel.setProperty("/busy", false);
				
			},
			onErrorGetOrderDetails: function (error) {
				var oViewModel = this.getView().getModel("changeOrderViewModel");
				oViewModel.setProperty("/busy", false);
				var errorResponse = JSON.parse(error.responseText);
				var errorMessage = errorResponse.error.message.value;
				sap.m.MessageToast.show(
					errorMessage,
					{
						duration: 6000
					}
					);
			},
			updateOrderDetails: function (data, isFetch) {
				var changeOrderHeaderModel = this.getOwnerComponent().getModel("changeOrderHeaderModel");
				changeOrderHeaderModel.setProperty("/netAmount", data.NetAmount);
				changeOrderHeaderModel.setProperty("/freightCharges", data.FreightChgs);
				changeOrderHeaderModel.setProperty("/taxAmount", data.TaxAmount);
				changeOrderHeaderModel.setProperty("/totalAmount", data.TotalAmount);
				changeOrderHeaderModel.setProperty("/customerID", data.SoldToPartyID);
				changeOrderHeaderModel.setProperty("/customer", data.SoldToPartyDescr);
				changeOrderHeaderModel.setProperty("/salesOrderID", data.SalesOrderID);
				changeOrderHeaderModel.setProperty("/orderTypeCode", data.SalesOrderTypeCode);
				
				changeOrderHeaderModel.setProperty("/requestedDeliveryDate", data.RequestedDeliveryDate);
				changeOrderHeaderModel.setProperty("/customerPO", data.PurchaseOrderNumber);
				changeOrderHeaderModel.setProperty("/weight", data.BtgewR);
				changeOrderHeaderModel.setProperty("/weightUnit", data.GeweiR);
				changeOrderHeaderModel.setProperty("/area", data.VolumR);
				changeOrderHeaderModel.setProperty("/areaUnit", data.VolehR);
				changeOrderHeaderModel.setProperty("/orderType", data.SalesOrderTypeDescr);
				changeOrderHeaderModel.setProperty("/HeaderStatus", data.HeaderStatus);
				changeOrderHeaderModel.setProperty("/PaymentTermCode", data.PaymentTermCode);
				changeOrderHeaderModel.setProperty("/Zzpaidfull", data.Zzpaidfull);
				
				if (data.ReadTime) {
					changeOrderHeaderModel.setProperty("/ReadTime", data.ReadTime);
				}
				
				
				this.updateHeaderStatus(data);
				
				if (data.ItemSet && data.ItemSet.results) {
					if (data.ItemSet.results.length > 0) {
						var item = data.ItemSet.results[0];
						if (item) {
							changeOrderHeaderModel.setProperty("/deliveryPlantCode", item.Plant);
							changeOrderHeaderModel.setProperty("/deliveryPlantDesc", item.PlantDescr);
						}
					}
					this.updateItemSet(data.ItemSet.results, isFetch);
					
				}
				
				if (data.HeaderPartnerSet && data.HeaderPartnerSet.results) {
					this.updatePartnerDetails(data.HeaderPartnerSet.results);
				}
			},
			
			updatePartnerDetails: function (partnerSet) {
				var changeOrderHeaderModel = this.getOwnerComponent().getModel("changeOrderHeaderModel");
				var partnerCount = partnerSet.length;
				for (var partnerIndex = 0; partnerIndex < partnerCount; partnerIndex++) {
					var partner = partnerSet[partnerIndex];
					if (partner && partner.PartnerFunctionCode === "SH") {
						changeOrderHeaderModel.setProperty("/headerShipTo", partner.Name);
						break;
					}
				}
			},
			getLocalDate: function (date) {
				var localDate = new Date();
				var day = date.getDate();
				var month = date.getMonth();
				var year = date.getFullYear();
				localDate.setFullYear(year, month, day);
				return localDate;
			
			},
			getDateInputValueString: function (date) {
				var day = date.getDate();
				if (day < 10) {
					day = "0"+day;
				}
				var month = date.getMonth();
				month = month+1;
				if (month < 10) {
					month = "0"+ month;
				}
				var year = date.getFullYear();
				return day+"/"+month+"/"+year;
			},
			updateItemSet: function (itemSet, isFetch) {
				var changeOrderHeaderModel = this.getOwnerComponent().getModel("changeOrderHeaderModel");
				var oViewModel = this.getView().getModel("changeOrderViewModel");
				var orderTypeCode = changeOrderHeaderModel.getProperty("/orderTypeCode");
				var headerStatusCode = changeOrderHeaderModel.getProperty("/headerStatusCode");
				var isPaymentPaid = oViewModel.getProperty("/paymentInd");
				var itemCount = itemSet.length;
				var orderItemSet = [];
				var isLineItemAmt = true;
				var isImOrderConfirmedQty = true;
				for (var itemIndex = 0; itemIndex < itemCount; itemIndex++) {
					var item = itemSet[itemIndex];
					if (item) {
						var orderItem = {};
						var salesUnit = item.SalesUnit;
						var kmein = item.Kmein;
						var salesUnitSet = [];
						orderItem.salesOrderID = item.SalesOrderID;
						orderItem.itemID = item.ItemID;
						orderItem.materialNo =  item.MaterialID;  
						orderItem.materialDesc = item.ItemDescr;
						orderItem.quantity = item.OrderQty;
						orderItem.stockUnit = item.SalesUnit;
						orderItem.salesUnitPrice = item.Netpr;
						orderItem.salesUnit = item.Kmein;
						orderItem.deliveryDate = this.getLocalDate(item.RequestedDeliveryDate);
						orderItem.deliveryDateValue = this.getDateInputValueString(item.RequestedDeliveryDate);
						orderItem.confirmedQuantity = item.ConfirmedQty;
						orderItem.unitPrice = item.NetAmount;
						orderItem.currencyUnit = item.DocumentCurrency;
						orderItem.totalAmount = item.TotalAmount;
						//orderItem.Is3rdParty = item.Is3rdParty;
						orderItem.Is3rdParty = !!item.Is3rdParty; 			//I561959 - UI Upgrade fix
						orderItem.ItemCategoryCode = item.ItemCategoryCode;
						
						orderItem.kzwi2 = item.Kzwi2;
						
						orderItem.SchedLineSet = item.SchedLineSet.results;
						orderItem.PriceCondSet = item.PriceCondSet.results;
						if (isFetch) {
							orderItem.CopyInd = "X";	
						} else {
							orderItem.CopyInd = item.CopyInd;	
						}
						
						if (parseFloat(item.Kzwi2) <= 0) {
							isLineItemAmt = false;
						}
						if (item.ConfirmedQty !== item.OrderQty && orderTypeCode === "YIO") {
							isImOrderConfirmedQty = false;
						}
						
						salesUnitSet.push({"salesUnitType" : salesUnit});
						salesUnitSet.push({"salesUnitType" : kmein});
						orderItem.salesUnitList = salesUnitSet;
						
						orderItem.ItemStatus = item.ItemStatus;
						orderItem.itemStatusCode = item.ItemStatus.ItemStatusCode;
						orderItem.itemStatusDesc = item.ItemStatus.ItemStatusDescr;
						this.updateItemConditions(orderItem, item);
						orderItemSet.push(orderItem);
					}
				}
				if (isLineItemAmt) {
					oViewModel.setProperty("/isValidLineItemAmt", true);
				} else {
					oViewModel.setProperty("/isValidLineItemAmt", false);
				}
				if (isImOrderConfirmedQty) {
					oViewModel.setProperty("/isValidConfQtyForIMO", true);
				} else {
					oViewModel.setProperty("/isValidConfQtyForIMO", false);
				}
				changeOrderHeaderModel.setProperty("/ItemSet", orderItemSet);
				if (headerStatusCode !== "C" && isPaymentPaid === "false") {
					var newItem = this.createEmptyItem();
					changeOrderHeaderModel.setProperty("/ItemSet/"+  itemCount, newItem);
				}
				//changeOrderHeaderModel.setProperty("/ItemSet", orderItemSet);
				changeOrderHeaderModel.setProperty("/totalItemCount", itemCount);
				
			},
			updateItemConditions: function (orderItem, item) {
				var conditionSet = item.PriceCondSet.results;
				var conditionCount = conditionSet.length;
				var discountType = "%";
				var discount = null;
				var counter = null;
				for (var conditionIndex = 0; conditionIndex < conditionCount; conditionIndex++) {
					var condition = conditionSet[conditionIndex];
					if (condition.CondTypeCode ==="ZMA5" || condition.CondTypeCode ==="ZMA4" ) {
						discount =  condition.AmountInternal;
						counter = condition.Counter;
						if (condition.CondTypeCode ==="ZMA5") {
							discountType="AUD";
							orderItem.unitOfMeasure = condition.UnitOfMeasure;
						} else if (condition.CondTypeCode ==="ZMA4") {
							discountType="%";
						}
					}
					
				}
				orderItem.discountType = discountType;
				if (discount) {
					orderItem.discount = discount;
				}
				if (counter) {
					orderItem.counter = counter;
				}
				
			},
			getDiscountType: function (item) {
				var conditionSet = item.PriceCondSet.results;
				var conditionCount = conditionSet.length;
				for (var conditionIndex = 0; conditionIndex < conditionCount; conditionIndex++) {
					var condition = conditionSet[conditionIndex];
					if (condition.CondTypeCode ==="ZMA5") {
						return "AUD";
					} else if (condition.CondTypeCode ==="ZMA4") {
						return "%";
					}
					
				}
				return "AUD";
			},
			getDiscount: function (item) {
				var conditionSet = item.PriceCondSet.results;
				var conditionCount = conditionSet.length;
				for (var conditionIndex = 0; conditionIndex < conditionCount; conditionIndex++) {
					var condition = conditionSet[conditionIndex];
					if (condition.CondTypeCode ==="ZMA5" || condition.CondTypeCode ==="ZMA4" ) {
						var discount =  condition.AmountInternal;
						return discount;
					} 
				}
			},
			getCounter: function (item) {
				var conditionSet = item.PriceCondSet.results;
				var conditionCount = conditionSet.length;
				for (var conditionIndex = 0; conditionIndex < conditionCount; conditionIndex++) {
					var condition = conditionSet[conditionIndex];
					if (condition.CondTypeCode ==="ZMA5" || condition.CondTypeCode ==="ZMA4" ) {
						var counter =  condition.Counter;
						return counter;
					} 
				}
			},
			updateHeaderStatus: function (data) {
				var oHeaderStatus = data.HeaderStatus;
				var changeOrderHeaderModel = this.getOwnerComponent().getModel("changeOrderHeaderModel");
				if (oHeaderStatus) {
					changeOrderHeaderModel.setProperty("/headerStatusCode", oHeaderStatus.DocumentProcessingStatusCode);
					changeOrderHeaderModel.setProperty("/headerStatusDesc", oHeaderStatus.DocumentProcessingStatusDescr);
				}
			},
			
			handleBack:function(){
				this.getRouter().navTo("detail", {
						custContextPath: this.sCustContextPath
					}, true);
			},
			onItemPress: function (oEvent) {
				var oViewModel = this.getView().getModel("changeOrderViewModel");
				var selectedDoc = oViewModel.getProperty("/salesOrderID");
				var paymentInd = oViewModel.getProperty("/paymentInd");
				var changeOrderHeaderModel = this.getOwnerComponent().getModel("changeOrderHeaderModel");
				var itemContextPath = oEvent.getParameter("listItem").getBindingContextPath();
				var materialDesc = changeOrderHeaderModel.getProperty(itemContextPath +"/materialDesc");
				var itemIndex;
				var oParameter;
				if (materialDesc) {
					oViewModel.setProperty("/busy", true);
					itemIndex = itemContextPath.substring(itemContextPath.lastIndexOf("/") + 1, itemContextPath.length);
					oParameter = {
						"custContextPath": this.sCustContextPath,
						"documentID": selectedDoc,
						"itemIndex": itemIndex,
						"paymentInd": paymentInd
					};
					this.getOwnerComponent().getRouter().navTo("orderDetails",oParameter, true);
					oViewModel.setProperty("/busy", false);	
				}
			},
			onMaterialSearch: function(oEvent) {
				var serchText = oEvent.getParameter("query");
				var listControl = oEvent.getSource().getParent().getParent().getContent();
				var binding = listControl[1].getBinding("items");
				var oFilters = null;
				var materialFilter = new sap.ui.model.Filter("Description", FilterOperator.EQ, serchText);
				oFilters = new sap.ui.model.Filter([materialFilter]);
				binding.aFilters = [];
				binding.filter(oFilters, "Application");
			},
		
			onMaterialValueHelpTapped: function (oEvent) {
				var changeOrderHeaderModel = this.getOwnerComponent().getModel("changeOrderHeaderModel");
				var oItemBindingContext = oEvent.getSource().getParent().getBindingContext('changeOrderHeaderModel');
				var itemsPath = oItemBindingContext.sPath;
				this.selectedItemPath = itemsPath;
				var userInput = oEvent.getSource().getValue();
				if (!this.materialValueHelp) {
					this.materialValueHelp = sap.ui.xmlfragment("materialSearch","com.csr.customercockpit.view.fragment.MaterialValueHelp", this);
					this.getView().addDependent(this.materialValueHelp);
				}
				var materialList = sap.ui.core.Fragment.byId("materialSearch","materialListId");
				materialList.removeAllItems();
				var materialListItem = sap.ui.core.Fragment.byId("materialSearch","materialListItem");
				var customerID = changeOrderHeaderModel.getProperty("/customerID");
				var oCustomerIDFilter = new sap.ui.model.Filter("Kunnr", FilterOperator.EQ, customerID);
				var oProductSearchFilter = new sap.ui.model.Filter("Description", "EQ", userInput);
				var oFilters =  new sap.ui.model.Filter([oProductSearchFilter, oCustomerIDFilter], true);
				
				materialList.bindItems("/ProductLSet", materialListItem, null, oFilters);
				this.materialValueHelp.open();
			},
		
			onMaterialSelect: function(oEvent) {
				var changeOrderHeaderModel = this.getOwnerComponent().getModel("changeOrderHeaderModel");
				var oMaterialPath = oEvent.getSource().getBindingContext().sPath;
				var oMaterial = this.getModel().getProperty(oMaterialPath);
				this.addItemToCart(oMaterial);
				var cartItems = changeOrderHeaderModel.getProperty("/ItemSet");
				var itemsCount = cartItems.length;
				var cartItem = this.createEmptyItem();
				changeOrderHeaderModel.setProperty("/ItemSet/"+itemsCount,cartItem);
				this.materialValueHelp.close();
			},
		
			closeMaterialValueHelp: function(){
				if(this.materialValueHelp){
					this.materialValueHelp.close();
				}
			},
			createEmptyItem: function () {
				var changeOrderHeaderModel = this.getOwnerComponent().getModel("changeOrderHeaderModel");
				var newItem = {};
				var requestedDeliveryDate = changeOrderHeaderModel.getProperty("/requestedDeliveryDate");
				var todayDate = new Date();
				var salesOrderID = changeOrderHeaderModel.getProperty("/salesOrderID");
				if (requestedDeliveryDate > todayDate) {
					newItem.deliveryDate = requestedDeliveryDate;
					newItem.deliveryDateValue = this.getDateInputValueString(requestedDeliveryDate);
				} else {
					newItem.deliveryDate = todayDate;
					newItem.deliveryDateValue = this.getDateInputValueString(todayDate);
				}
				
				newItem.SalesOrderID = salesOrderID;
				newItem.itemStatusCode = "A";
				this.addFocusToLastItem();
				return newItem;
			},
			addFocusToLastItem: function() {
				var changeOrderHeaderModel = this.getOwnerComponent().getModel("changeOrderHeaderModel");
				var itemSet = changeOrderHeaderModel.getProperty("/ItemSet");
				var itemCount = itemSet.length;
				var orderItemsTable = this.getView().byId("orderItems");
				orderItemsTable.addEventDelegate({
					onAfterRendering: function() {
						jQuery.sap.delayedCall(0, this, function() {
							if ($("input:enabled[id*=orderItems-" + itemCount + "]")[0]) {
								$("input:enabled[id*=orderItems-" + itemCount + "]")[0].focus();
							}
						});
					}
	
				});
			},
			onQuantityChange: function(oEvent) {
				var changeOrderHeaderModel = this.getOwnerComponent().getModel("changeOrderHeaderModel");
				var itemPath = oEvent.getSource().getParent().getBindingContext("changeOrderHeaderModel").sPath;
				var cartQuantity = changeOrderHeaderModel.getProperty(itemPath+"/quantity");
				changeOrderHeaderModel.setProperty(itemPath+"/confirmedQuantity","");
				
				if (!cartQuantity || cartQuantity <= 0) {
					changeOrderHeaderModel.setProperty(itemPath+"/quantityShowValueStateMessage", true);
					changeOrderHeaderModel.setProperty(itemPath+"/quantityValueState", "Error");
					changeOrderHeaderModel.setProperty("/errorsExist", true);
				} else {
					changeOrderHeaderModel.setProperty(itemPath+"/quantityShowValueStateMessage", false);
					changeOrderHeaderModel.setProperty(itemPath+"/quantityValueState", "None");
					changeOrderHeaderModel.setProperty("/errorsExist", false);
				}
			},
			onDiscountTypeChange: function (oEvent) {
				this.handleEnterKeyPress(oEvent);
			},
			onUnitOfMeasureChange: function (oEvent) {
				this.handleEnterKeyPress(oEvent);
			},
			onMaterialSubmit: function (oEvent) {
				this.handleEnterKeyPress(oEvent);
			},
			onQuantitySubmit: function (oEvent) {
				this.handleEnterKeyPress(oEvent);
			},
			onDiscountSubmit: function (oEvent) {
				this.handleEnterKeyPress(oEvent);
			},
			handleEnterKeyPress: function (oEvent) {
				var oViewModel = this.getView().getModel("changeOrderViewModel");
				oViewModel.setProperty("/busy", true);
				var changeOrderHeaderModel = this.getOwnerComponent().getModel("changeOrderHeaderModel");
				var oItemBindingContext = oEvent.getSource().getParent().getBindingContext("changeOrderHeaderModel");
				var itemsPath = oItemBindingContext.sPath;
				this.selectedItemPath = itemsPath;
				var orderItem = changeOrderHeaderModel.getProperty(itemsPath);
				var materialNo = orderItem.materialNo;          
				var materialDesc = orderItem.materialDesc;
				
				if (materialDesc) {
					this.onAddItem();
				} else if (materialNo) {
				
					var oThis = this;
					var oFilters = [];
					var oModel = this.getModel();
					var customerID = changeOrderHeaderModel.getProperty("/customerID");
					var oCustomerIDFilter = new sap.ui.model.Filter("Kunnr", FilterOperator.EQ, customerID);
					var oFilterDescription = new sap.ui.model.Filter("Description", FilterOperator.EQ, materialNo);
					
					oFilters.push(oCustomerIDFilter);
					oFilters.push(oFilterDescription);
	
					oModel.read("/ProductLSet", 
					{
						filters: oFilters,
						success: function (data) {
							oThis.onGetProductSuccessCallback(data);
						}, 
						error: function (error) {
							oThis.onGetProductErrorCallback(error);
						}
					});
				} else {
					// Currently DO Nothing
				}
			},
			onGetProductSuccessCallback: function (data) {
				var oViewModel = this.getView().getModel("changeOrderViewModel");
				if (data.results && data.results.length >= 1) {
					this.addItemToCart(data.results[0]);
				} else {
					sap.m.MessageToast.show(
						this.getResourceBundle().getText("unableToFetchProduct"),
						{
							duration: 6000
						}
					);
				}
				oViewModel.setProperty("/busy", false);
			},
			onGetProductErrorCallback: function (error) {
				var oViewModel = this.getView().getModel("changeOrderViewModel");
				oViewModel.setProperty("/busy", false);
				var errorResponse = JSON.parse(error.responseText);
				var errorMessage = errorResponse.error.message.value;
				sap.m.MessageToast.show(
					errorMessage,
					{
						duration: 6000
					}
				);
			},
			validateWithTodayDate: function (dateValue) {
				var todaysDate = new Date();
				if (dateValue.getFullYear() < todaysDate.getFullYear() ||
					(dateValue.getFullYear() === todaysDate.getFullYear() && dateValue.getMonth() < todaysDate.getMonth()) ||
					(dateValue.getFullYear() === todaysDate.getFullYear() && dateValue.getMonth() === todaysDate.getMonth() 
					&& dateValue.getDate() < todaysDate.getDate())) {
					return false;	
				}
				return true;
			},
			validateDate: function(dateInput, dateValue) {
				var datePat = /^(\d{1,2})(\/|-)(\d{1,2})\2(\d{2}|\d{4})$/;
				var matchArray = dateInput.match(datePat);
				var result = true;
				var year;
				var month;
				var day;
				
				if (matchArray === null) {
					 return false;
				} else {
					year = parseInt(matchArray[4],10);
					if (year.toString().length === 4) {
						day = parseInt(matchArray[1],10);//matchArray[1];
						month = parseInt(matchArray[3],10);//matchArray[3];
						dateValue = new Date(year, month-1, day);
					} else {
						day = dateValue.getDate();
						month = dateValue.getMonth()+1;
						year = dateValue.getFullYear();
					}
					result = this.validateWithTodayDate(dateValue);
					if (!result) {
						return false;
					}
					if ((month < 1 || month > 12)|| (day < 1 || day > 31) || 
						((month === 4 || month === 6 || month === 9 || month === 11) && day === 31)) {
						return false;
					}
					if (month === 2) {
						var isleap = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0));
						if (day > 29 || (day === 29 && !isleap)) {
							return false;
						}
					}
				}
				return result;
			},
			validateCart: function () {
				var changeOrderHeaderModel = this.getOwnerComponent().getModel("changeOrderHeaderModel");
				var orderType = changeOrderHeaderModel.getProperty("/orderTypeCode");
				var cartItems = changeOrderHeaderModel.getProperty("/ItemSet");
				var cartItemCount = cartItems.length;
				var isQuantityValid = true;
				var isDateValid = true;
				for(var cartIndex=0; cartIndex < cartItemCount; cartIndex++) {
					var cartItem = cartItems[cartIndex];
					var materiaDesc = cartItem.materialDesc;                         
					var cartQuantity = cartItem.quantity; 
					var cartDeliveryDateValue = cartItem.deliveryDateValue; 
					var cartDeliveryDate = cartItem.deliveryDate; 
					var cartItemStatusCode = cartItem.itemStatusCode;
					if (materiaDesc && cartItemStatusCode === "A") {
						if (cartQuantity <= 0 && !isNaN(parseInt(cartQuantity,10))){
							isQuantityValid = false;
							changeOrderHeaderModel.setProperty("/ItemSet/"+cartIndex+"/quantityShowValueStateMessage", true);
							changeOrderHeaderModel.setProperty("/ItemSet/"+cartIndex+"/quantityValueState", "Error");
						} else {
							changeOrderHeaderModel.setProperty("/ItemSet/"+cartIndex+"/quantityShowValueStateMessage", false);
							changeOrderHeaderModel.setProperty("/ItemSet/"+cartIndex+"/quantityValueState", "None");
						}
						if (orderType!== "YQT" && !this.validateDate(cartDeliveryDateValue, cartDeliveryDate)) {
							isDateValid = false;
							changeOrderHeaderModel.setProperty("/ItemSet/"+cartIndex+"/deliveryDateShowValueStateMessage", true);
							changeOrderHeaderModel.setProperty("/ItemSet/"+cartIndex+"/deliveryDateValueState", "Error");
						} else {
							changeOrderHeaderModel.setProperty("/ItemSet/"+cartIndex+"/deliveryDateShowValueStateMessage", false);
							changeOrderHeaderModel.setProperty("/ItemSet/"+cartIndex+"/deliveryDateValueState", "None");
						}
					}
				}
				if (isDateValid && isQuantityValid) {
					return true;
				}
				return false;
			},
			validateCartLineItemAmount: function () {
				var changeOrderHeaderModel = this.getOwnerComponent().getModel("changeOrderHeaderModel");
				var cartItems = changeOrderHeaderModel.getProperty("/ItemSet");
				var cartItemCount = cartItems.length;
				var isCartAmountValid = true;
				
				for(var cartIndex=0; cartIndex < cartItemCount; cartIndex++) {
					var cartItem = cartItems[cartIndex];
					var materiaDesc = cartItem.materialDesc;                         
					var cartAmount = cartItem.kzwi2; 
					if (materiaDesc) {
						if(cartAmount <= 0) {
							isCartAmountValid = false;
						} 				
					}
				}
				if (isCartAmountValid) {
					return true;
				}
				return false;
			},
			onDeliveryDateChange: function (oEvent) {
				var changeOrderHeaderModel = this.getOwnerComponent().getModel("changeOrderHeaderModel");
				var cartItemPath = oEvent.getSource().getParent().getBindingContext("changeOrderHeaderModel").sPath;
				var deliveryDateValue = changeOrderHeaderModel.getProperty(cartItemPath+"/deliveryDateValue");
				var deliveryDate = changeOrderHeaderModel.getProperty(cartItemPath+"/deliveryDate");
			
				if (!this.validateDate(deliveryDateValue, deliveryDate)) {
					changeOrderHeaderModel.setProperty(cartItemPath+"/deliveryDateShowValueStateMessage", true);
					changeOrderHeaderModel.setProperty(cartItemPath+"/deliveryDateValueState", "Error");
					return false;
				} else {
					changeOrderHeaderModel.setProperty(cartItemPath+"/deliveryDateShowValueStateMessage", false);
					changeOrderHeaderModel.setProperty(cartItemPath+"/deliveryDateValueState", "None");
					return true;
				}
			},
			addItemToCart: function (item) {
				var changeOrderHeaderModel = this.getOwnerComponent().getModel("changeOrderHeaderModel");
				var materialNo = item.Matnr;
				var materialDesc = item.Description;
				var stockUnit = item.StockUnit;
				var price = item.ArticlePrice;
				var currencyUnit = item.ArticlePriceCurkey;
				var qunatity = changeOrderHeaderModel.getProperty(this.selectedItemPath+"/quantity");
				var discount = changeOrderHeaderModel.getProperty(this.selectedItemPath+"/discount");
				var discountType = changeOrderHeaderModel.getProperty(this.selectedItemPath+"/discountType");
				if (!qunatity) {
					qunatity = "1";
				}
				var product = {
					"materialNo": materialNo,
					"materialDesc": materialDesc,
					"stockUnit": stockUnit,
					"unitPrice": price,
					"quantity": qunatity,
					"currencyUnit": currencyUnit,
					"discount": discount,
					"discountType": discountType,
					"isAddedItem": true
				};
				changeOrderHeaderModel.setProperty(this.selectedItemPath, product);
				this.updateDeliveryDate(this.selectedItemPath);
				this.onAddItem();
				
			},
			updateDeliveryDate: function (itemPath) {
				var changeOrderHeaderModel = this.getOwnerComponent().getModel("changeOrderHeaderModel");
				var requestedPickupDate = changeOrderHeaderModel.getProperty("/requestedDeliveryDate");
				var requestedPickupValue = this.getDateInputValueString(requestedPickupDate);
				var today = new Date();
				var todayPickUpValue = this.getDateInputValueString(today);
				
				if (requestedPickupDate > today) {
					changeOrderHeaderModel.setProperty(itemPath + "/deliveryDate", requestedPickupDate);
					changeOrderHeaderModel.setProperty(itemPath + "/deliveryDateValue", requestedPickupValue);
				} else {
					changeOrderHeaderModel.setProperty(itemPath + "/deliveryDate", today);
					changeOrderHeaderModel.setProperty(itemPath + "/deliveryDateValue", todayPickUpValue);
				}
			},
			onAddItem : function () {
				var oViewModel = this.getView().getModel("changeOrderViewModel");
				this.updateOrderSimulate = true;
				var isCartValid =  this.validateCart();
				if (isCartValid) {
					oViewModel.setProperty("/busy", true);
					this.triggerUpdateOrder(false);
				} else {
					oViewModel.setProperty("/busy", false);
					sap.m.MessageToast.show(
						this.getResourceBundle().getText("mandatoryFieldsCheck"),
						{
							duration: 6000
						});
				}
			},
			addItemSetInRequest: function (isDelete) {
				var changeOrderHeaderModel = this.getOwnerComponent().getModel("changeOrderHeaderModel");
				var changeOrderDeleteItemsModel = this.getOwnerComponent().getModel("changeOrderDeleteItemsModel");
				var orderItems = null;
				var ItemSet = [];
				var salesOrderID = changeOrderHeaderModel.getProperty("/salesOrderID");
				var orderType = changeOrderHeaderModel.getProperty("/orderTypeCode");
				var deliveryPlant = changeOrderHeaderModel.getProperty("/deliveryPlantCode");
				if (isDelete) {
					orderItems = changeOrderDeleteItemsModel.getProperty("/ItemSet");
				} else {
					orderItems = changeOrderHeaderModel.getProperty("/ItemSet");
				}
				
				if (!orderItems) {
					return ItemSet;
				}
				
				var itemCount = orderItems.length;
				
				
				for (var itemIndex = 0; itemIndex < itemCount; itemIndex++) {
					var orderItem = null;
					if (isDelete) {
						orderItem= changeOrderDeleteItemsModel.getProperty("/ItemSet/"+ itemIndex);
					} else {
						orderItem= changeOrderHeaderModel.getProperty("/ItemSet/"+ itemIndex);	
					}
					if (orderItem.isAddedItem && isDelete) {
						continue;
					}
					var materialNo = orderItem.materialNo;
					var stockUnit = orderItem.stockUnit;
					var itemDiscount =  orderItem.discount;
					var itemDiscountType = orderItem.discountType;
					var counter = orderItem.counter;
					if (materialNo) {
						var item = {};
						var quantity = orderItem.quantity;
						if (!quantity) {
							quantity = "1";
						}
						if (!orderItem.isAddedItem) {
							item.ItemID = orderItem.itemID;
						}
						item.SalesOrderID = salesOrderID;
						item.MaterialID =  materialNo;                    
						item.SalesUnit = stockUnit;
						item.Plant = deliveryPlant;
						item.OrderQty= quantity;
						if (orderType !== "YQT") {
							item.RequestedDeliveryDate = this.formatter.formatDate(orderItem.deliveryDate);
						}
						if (isDelete) {
							item.Updkz = "D";
						} else {
							item.Updkz = "U";
						}
						var ItemPriceCondSet = [];
						var itemCondition = {};
						
						if (itemDiscountType) {
							if (!itemDiscount) {
								itemDiscount = "0";
							}
							if (itemDiscountType === "AUD") {
								itemCondition.CondTypeCode = "ZMA5";
								itemCondition.UnitOfMeasure = orderItem.salesUnit;
							} else {
								itemCondition.CondTypeCode = "ZMA4";	
							}
							itemCondition.Counter = counter;
							itemCondition.AmountInternal = itemDiscount; 
							ItemPriceCondSet.push(itemCondition);
						}
						item.ItemStatus = orderItem.ItemStatus;
						item.PriceCondSet = ItemPriceCondSet;
						ItemSet.push(item);
					}
					
				}
				return ItemSet;
			},
			triggerUpdateOrder: function (updateOrder) {
				var updateOrderRequest = {};
				var oThis = this;
				var changeOrderHeaderModel = this.getOwnerComponent().getModel("changeOrderHeaderModel");
				var oViewModel = this.getView().getModel("changeOrderViewModel");
				var errorsExist = changeOrderHeaderModel.getProperty("/errorsExist");
				if (errorsExist) {
					sap.m.MessageToast.show(
						this.getResourceBundle().getText("resolveErrors"),
						{
							duration: 6000
						}
					);
					oViewModel.setProperty("/busy", false);
					return;
				}
				var salesOrderID = changeOrderHeaderModel.getProperty("/salesOrderID");
				var orderTypeCode = changeOrderHeaderModel.getProperty("/orderTypeCode");
				var headerStatus = changeOrderHeaderModel.getProperty("/HeaderStatus");
				var paymentTermCode = changeOrderHeaderModel.getProperty("/PaymentTermCode");
				var customerPO = changeOrderHeaderModel.getProperty("/customerPO");
				var requestTime = changeOrderHeaderModel.getProperty("/ReadTime");
				updateOrderRequest.SalesOrderID = salesOrderID;
				updateOrderRequest.SalesOrderTypeCode = orderTypeCode;
				updateOrderRequest.PurchaseOrderNumber = customerPO;
				updateOrderRequest.Updkz = "U";
				if (!updateOrder || (paymentTermCode ==="CASH" || paymentTermCode ==="COD")) {
					updateOrderRequest.Simul = "X";
				}
				if (updateOrder && orderTypeCode === "YQT" ) {
					updateOrderRequest.Simul = "";
				}
				if (headerStatus) {
					updateOrderRequest.HeaderStatus = headerStatus;
				}
				
				if(!this.updateOrderSimulate) {
					updateOrderRequest.IsCheckout = "X";
				}
				updateOrderRequest.ReadTime = requestTime;
				
				var updatedItemSet = OrderServiceUtil.getItemSetForUpdateOrderReq.apply(this);
				var deletedItemSet = OrderServiceUtil.getItemSetForUpdateOrderReq.apply(this, [true]);
				//var updatedItemSet = this.addItemSetInRequest();
				//var deletedItemSet = this.addItemSetInRequest(true);
				var ItemSet = updatedItemSet.concat(deletedItemSet);
				updateOrderRequest.ItemSet = ItemSet;
				var oModel = this.getModel();
				oModel.setUseBatch(true);
				oModel.create("/HeaderSet", updateOrderRequest,
					{
						success: function (data) {
							oThis.onUpdateOrderSuccessCallback(data, updateOrder);
						},
						error: function (error) {
							oThis.onUpdateOrderErrorCallback(error);
						}
					}
				);
				
			},
			onUpdateOrderSuccessCallback: function (data, updateOrder) {
				var oViewModel = this.getView().getModel("changeOrderViewModel");
				oViewModel.setProperty("/busy", true);
				this.updateOrderDetails(data);
				var isValidLineItemAmt = oViewModel.getProperty("/isValidLineItemAmt");
				var isValidConfQtyForIMO = oViewModel.getProperty("/isValidConfQtyForIMO");
				
				var paymentTermCode =  data.PaymentTermCode;
				var oModel = this.getModel();
				oModel.setUseBatch(true);
				var salesOrderID = data.SalesOrderID;
				var salesOrderTypeCode = data.SalesOrderTypeCode;
				var orderMsg;
				var paymentInd;
				var errorMsg = data.ErrorMessage;
				if (this.updateOrderSimulate) {
					// DO Nothing
				} else if (!isValidLineItemAmt) {
					sap.m.MessageToast.show(
					this.getResourceBundle().getText("invalidItemAmountMsg"),
					{
						duration: 6000
					});
				} else if (!isValidConfQtyForIMO) {
					sap.m.MessageToast.show(
					this.getResourceBundle().getText("invalidConfQtyMsgForIMO"),
					{
						duration: 6000
					});
				} else if (updateOrder && salesOrderTypeCode !=="YQT" && (paymentTermCode === "CASH" || paymentTermCode === "COD") && data.Zzpaidfull !== "X") {
					var changeOrderHeaderModel = this.getOwnerComponent().getModel("changeOrderHeaderModel");
					var documentID = changeOrderHeaderModel.getProperty("/salesOrderID");
					paymentInd = oViewModel.getProperty("/paymentInd");
					this.getRouter().navTo("payment", {
						documentID: documentID,
						custContextPath: this.sCustContextPath,
						paymentInd: paymentInd,
						query: {
							action: "changeOrder",
							dueAmount: data.TotalAmount
						}
					}, true);
				} else {
					//changeOrderDeleteItemsModel.setProperty("/ItemSet", null);
					if (salesOrderTypeCode === "YQT") {
						orderMsg = this.getResourceBundle().getText("quoteUpdated",[salesOrderID, errorMsg]);
					} else if (salesOrderTypeCode === "YIO") {
						orderMsg = this.getResourceBundle().getText("immediateOrderUpdated",[salesOrderID, errorMsg]);
					} else if (salesOrderTypeCode === "YOR") {
						orderMsg = this.getResourceBundle().getText("standardOrderUpdated",[salesOrderID, errorMsg]);
					} else if (salesOrderTypeCode === "YOR1") {
						orderMsg = this.getResourceBundle().getText("thirdPartyOrderUpdated",[salesOrderID, errorMsg]);
					} else {
						orderMsg = this.getResourceBundle().getText("salesOrderUpdated",[salesOrderID, errorMsg]);
					}
					sap.m.MessageToast.show(
						orderMsg,
						{
							duration: 6000
						});
					this.handleCancel();
				}
				oViewModel.setProperty("/busy", false);
			},
			onUpdateOrderErrorCallback: function (error) {
				var oViewModel = this.getView().getModel("changeOrderViewModel");
				oViewModel.setProperty("/busy", false);
				var errorResponse = JSON.parse(error.responseText);
				var errorMessage = errorResponse.error.message.value;
				sap.m.MessageToast.show(
					errorMessage,
					{
						duration: 6000
					});
			},
			handleUpdateOrder: function() {
				var oViewModel = this.getView().getModel("changeOrderViewModel");
				var isCartValid = this.validateCart();
				var isValidPurchaseOrder = this.validateCustomerPO();       
				this.updateOrderSimulate = false;
				oViewModel.setProperty("/busy", true);
				
				if (isCartValid && isValidPurchaseOrder) {
					var isCartLineItemAmountValid = this.validateCartLineItemAmount();
					if (isCartLineItemAmountValid) {
						this.triggerUpdateOrder(true);
					} else {
						sap.m.MessageToast.show(
						this.getResourceBundle().getText("invalidItemAmountMsg"),
						{
							duration: 6000
						});
						oViewModel.setProperty("/busy", false);
					}
				} else {
					sap.m.MessageToast.show(
						this.getResourceBundle().getText("mandatoryFieldsCheck"),
						{
							duration: 6000
						});
					oViewModel.setProperty("/busy", false);
				}
				
			},
			handleCancel:function(){
				this.getRouter().navTo("detail", {
						custContextPath: this.sCustContextPath
					}, true);
			},
			updateTotalItemCount: function () {
				var changeOrderHeaderModel = this.getOwnerComponent().getModel("changeOrderHeaderModel");
				var changeOrderItems = changeOrderHeaderModel.getProperty("/ItemSet");
				var changeOrderItemsCount = changeOrderItems.length;
				changeOrderHeaderModel.setProperty("/totalItemCount", changeOrderItemsCount-1);
			},
			onItemDelete: function(oEvent) {
				var changeOrderDeleteItems = null;
				var oItemBindingContext = oEvent.getSource().getParent().getBindingContext('changeOrderHeaderModel');
				var itemsPath = oItemBindingContext.sPath;
				var itemLength = itemsPath.length;
				var itemIndex = itemsPath.substring(itemsPath.lastIndexOf("/")+1, itemLength);
				var changeOrderHeaderModel = this.getOwnerComponent().getModel("changeOrderHeaderModel");
				var changeOrderDeleteItemsModel = this.getOwnerComponent().getModel("changeOrderDeleteItemsModel");
				var changeOrderItems = changeOrderHeaderModel.getProperty("/ItemSet");
				var changeOrderItemsCount = changeOrderItems.length;
				
				var confirmMessage = this.getResourceBundle().getText("deletingCartItem");
				var oThis = this;	
				MessageBox.confirm(
					confirmMessage, {
						onClose: function(oAction) {
							if (oAction === "OK") {
								changeOrderDeleteItems = changeOrderItems.slice(parseInt(itemIndex, 10), parseInt(itemIndex, 10) + 1);
								changeOrderItems.splice(parseInt(itemIndex, 10), 1);
								if (changeOrderItemsCount === 1) {
									var cartItem =  oThis.createEmptyItem();
									changeOrderItems.push(cartItem);
								}
								changeOrderHeaderModel.setProperty("/ItemSet", changeOrderItems);
								changeOrderDeleteItemsModel.setProperty("/ItemSet", changeOrderDeleteItems);
								oThis.updateTotalItemCount();
							}
						}
					}
				);
			}
			
		});

	}
);