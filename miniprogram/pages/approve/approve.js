const app = getApp();

Page({
  data: {
    pendingList: [],
    vehicleList: [],
    userId: "",
    userName: "",
  },

  onLoad() {
    if (!app.globalData.isAdmin && !app.globalData.isApprover) {
      wx.showToast({ title: "无权限访问审批中心", icon: "none" });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    const userInfo = app.globalData.userInfo || {};
    this.setData({
      userId: userInfo._id || userInfo.userId || "",
      userName: userInfo.name || "",
    });

    this.loadVehiclesAndPending();
  },

  onShow() {
    this.loadVehiclesAndPending();
  },

  async loadVehiclesAndPending() {
    wx.showLoading({ title: "加载中..." });
    try {
      const [vehicleRes, pendingRes] = await Promise.all([
        wx.cloud.callFunction({ name: "getVehicleList" }),
        wx.cloud.callFunction({
          name: "getApplications",
          data: { filter: { status: "pending" } },
        }),
      ]);

      const vehicles = (vehicleRes.result && vehicleRes.result.data) || [];
      const pending = (pendingRes.result && pendingRes.result.data) || [];

      const list = pending.map((item) => {
        const selectedId = item.vehicleId || (vehicles[0] && vehicles[0]._id) || "";
        const selectedVehicle = vehicles.find((v) => v._id === selectedId);
        const selectedIndex = vehicles.findIndex((v) => v._id === selectedId);
        return {
          ...item,
          selectedVehicleId: selectedId,
          selectedVehiclePlate:
            (selectedVehicle && selectedVehicle.plateNumber) ||
            item.vehiclePlate ||
            (vehicles[0] && vehicles[0].plateNumber) ||
            "",
          selectedVehicleIndex: selectedIndex >= 0 ? selectedIndex : 0,
        };
      });

      this.setData({
        vehicleList: vehicles,
        pendingList: list,
      });
    } catch (err) {
      wx.showToast({ title: "加载失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  onVehicleChange(e) {
    const recordIndex = Number(e.currentTarget.dataset.recordIndex);
    const optionIndex = Number(e.detail.value);
    const vehicle = this.data.vehicleList[optionIndex];
    if (!vehicle || Number.isNaN(recordIndex)) return;

    const keyId = `pendingList[${recordIndex}].selectedVehicleId`;
    const keyPlate = `pendingList[${recordIndex}].selectedVehiclePlate`;
    const keyIndex = `pendingList[${recordIndex}].selectedVehicleIndex`;
    this.setData({
      [keyId]: vehicle._id,
      [keyPlate]: vehicle.plateNumber || "",
      [keyIndex]: optionIndex,
    });
  },

  handleApprove(e) {
    const { id, action, index } = e.currentTarget.dataset;
    const actionText = action === "approve" ? "同意" : "驳回";
    const record = this.data.pendingList[Number(index)] || {};

    if (action === "approve" && !record.selectedVehicleId) {
      wx.showToast({ title: "请先选择车辆", icon: "none" });
      return;
    }

    wx.showModal({
      title: `确认${actionText}`,
      content: `确定要${actionText}该申请吗？`,
      success: (res) => {
        if (!res.confirm) return;

        wx.showLoading({ title: "处理中..." });
        wx.cloud
          .callFunction({
            name: "approveApplication",
            data: {
              id,
              action,
              approverId: this.data.userId,
              approverName: this.data.userName,
              vehicleId: action === "approve" ? record.selectedVehicleId : "",
              vehiclePlate: action === "approve" ? record.selectedVehiclePlate : "",
            },
          })
          .then((resp) => {
            const result = resp.result || {};
            if (result.success) {
              wx.showToast({ title: result.message || "操作成功", icon: "success" });
              this.loadVehiclesAndPending();
            } else {
              wx.showToast({ title: result.message || "操作失败", icon: "none" });
            }
          })
          .catch(() => {
            wx.showToast({ title: "操作失败", icon: "none" });
          })
          .finally(() => wx.hideLoading());
      },
    });
  },
});
