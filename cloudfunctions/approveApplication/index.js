const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function checkApprover() {
  const wxContext = cloud.getWXContext();

  const userRes = await db
    .collection("users")
    .where({ openid: wxContext.OPENID })
    .limit(1)
    .get();

  const user = userRes.data[0];
  if (!user || (user.role !== "admin" && user.role !== "approver")) {
    return {
      ok: false,
      response: {
        success: false,
        message: "无权限，仅审批人和管理员可操作",
      },
    };
  }

  return { ok: true, user };
}

exports.main = async (event) => {
  try {
    const auth = await checkApprover();
    if (!auth.ok) return auth.response;

    const { id, action, vehicleId, vehiclePlate } = event;
    if (!id || !action) {
      return { success: false, message: "参数错误" };
    }
    if (action !== "approve" && action !== "reject") {
      return { success: false, message: "审批动作错误" };
    }

    const appRes = await db.collection("applications").doc(id).get();
    const application = appRes.data;
    if (!application) {
      return { success: false, message: "申请记录不存在" };
    }
    if (application.status !== "pending") {
      return { success: false, message: "该申请已处理，不能重复审批" };
    }

    let chosenVehicle = null;
    if (action === "approve") {
      const finalVehicleId = vehicleId || application.vehicleId;
      if (!finalVehicleId) {
        return { success: false, message: "请选择车辆后再审批通过" };
      }

      const vRes = await db.collection("vehicles").doc(finalVehicleId).get();
      chosenVehicle = vRes.data;
      if (!chosenVehicle) {
        return { success: false, message: "所选车辆不存在" };
      }
      if (chosenVehicle.status !== "available") {
        return { success: false, message: "所选车辆当前不可用，请更换车辆" };
      }
    }

    const updateData = {
      status: action === "approve" ? "approved" : "rejected",
      approverId: auth.user._id || "",
      approverName: auth.user.name || "",
      approveTime: db.serverDate(),
    };

    if (action === "approve" && chosenVehicle) {
      updateData.vehicleId = chosenVehicle._id;
      updateData.vehiclePlate = chosenVehicle.plateNumber || vehiclePlate || "";
    }

    await db.collection("applications").doc(id).update({ data: updateData });

    if (action === "approve" && chosenVehicle) {
      await db.collection("vehicles").doc(chosenVehicle._id).update({
        data: { status: "in_use" },
      });
    }

    return { success: true, message: action === "approve" ? "已同意" : "已驳回" };
  } catch (err) {
    return { success: false, message: err.message || "审批失败" };
  }
};
