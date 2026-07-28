/*Change History
 ***********************************************************************
 * Date         Incident      Author      Description
 * --------    -----------  ---------    ------------------
 *22/05/2018   255951/2018   C5253525    ePOS giving error "Date 01.01.1970 " error when changing quotes
 ***********************************************************************
 */
sap.ui.define([
	"com/csr/customercockpit/model/formatter"
], function(formatter) {
	"use strict";

	return {
		formatter: formatter,
		getItemSetForUpdateOrderReq: function(isDelete) {
			var changeOrderHeaderModel = this.getOwnerComponent().getModel("changeOrderHeaderModel");
			var changeOrderDeleteItemsModel = this.getOwnerComponent().getModel("changeOrderDeleteItemsModel");
			var orderItems = null;
			var ItemSet = [];
			var salesOrderID = changeOrderHeaderModel.getProperty("/salesOrderID");
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
					orderItem = changeOrderDeleteItemsModel.getProperty("/ItemSet/" + itemIndex);
				} else {
					orderItem = changeOrderHeaderModel.getProperty("/ItemSet/" + itemIndex);
				}
				if (orderItem.isAddedItem && isDelete || (!orderItem.CopyInd && isDelete) || orderItem.Is3rdParty === "X") {
					continue;
				}
				var materialNo = orderItem.materialNo;
				var stockUnit = orderItem.stockUnit;
				var itemDiscount = orderItem.discount;
				var itemDiscountType = orderItem.discountType;
				var counter = orderItem.counter;
				if (materialNo) {
					var item = {};
					var quantity = orderItem.quantity;
					if (!quantity) {
						quantity = "1";
					}

					if (orderItem.CopyInd === "X") {
						item.ItemID = orderItem.itemID;
						item.CopyInd = "X";
					}

					item.SalesOrderID = salesOrderID;
					item.MaterialID = materialNo;
					item.SalesUnit = stockUnit;
					item.Plant = deliveryPlant;
					item.OrderQty = quantity;
					//Start of changes by C5253525#255951/2018/ePOS giving error "Date 01.01.1970
					if (orderItem.deliveryDate === null) {
						var splitDate = orderItem.deliveryDateValue.split("/");
						var newDateFormat = splitDate[1] + "/" + splitDate[0] + "/" + splitDate[2];
						orderItem.deliveryDate = new Date(newDateFormat);
					}
					//End of changes by C5253525##255951/2018/ePOS giving error "Date 01.01.1970
					item.RequestedDeliveryDate = this.formatter.formatDate(orderItem.deliveryDate);
					item.ItemCategoryCode = orderItem.ItemCategoryCode;
					//item.Is3rdParty = orderItem.Is3rdParty;
					item.Is3rdParty = orderItem.Is3rdParty ? "X" : "";   //Changes by I561959 - UI upgrade fixes

					if (isDelete) {
						item.Updkz = "D";
					} else {
						item.Updkz = "U";
					}

					var ItemPriceCondSet = [];
					var itemCondition = {};

					if (itemDiscountType && !isDelete) {
						if (!itemDiscount) {
							itemDiscount = "0";
						}
						if (itemDiscountType === "AUD") {
							itemCondition.CondTypeCode = "ZMA5";
							itemCondition.UnitOfMeasure = orderItem.unitOfMeasure;
						} else {
							itemCondition.CondTypeCode = "ZMA4";
						}

						itemCondition.AmountInternal = itemDiscount;
						itemCondition.Counter = counter;
						ItemPriceCondSet.push(itemCondition);
					}
					item.ItemStatus = orderItem.ItemStatus;
					item.PriceCondSet = ItemPriceCondSet;
					item.SchedLineSet = [];
					ItemSet.push(item);
				}

			}
			return ItemSet;
		}
	};

});