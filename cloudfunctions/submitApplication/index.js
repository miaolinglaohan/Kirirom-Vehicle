const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function checkSubmitPermission(applicantId) {
  const wxContext = cloud.getWXContext()

  const userRes = await db.collection('users')
    .where({ openid: wxContext.OPENID })
    .limit(1)
    .get()

  const caller = userRes.data[0]
  if (!caller) {
    return {
      ok: false,
      response: {
        success: false,
        message: '用户未登记，请联系管理员'
      }
    }
  }

  if (caller.role === 'driver') {
    return {
      ok: false,
      response: {
        success: false,
        message: '专职驾驶员不能申请用车'
      }
    }
  }

  const canApplyForOthers = caller.role === 'admin' || caller.role === 'approver'
  const isSelf = caller._id === applicantId

  if (!isSelf && !canApplyForOthers) {
    return {
      ok: false,
      response: {
        success: false,
        message: '无权限为他人提交申请'
      }
    }
  }

  return { ok: true, caller }
}

exports.main = async (event) => {
  try {
    const {
      applicantId,
      department,
      purpose,
      startTime,
      vehicleId,
      vehiclePlate,
      driverId,
      driverName,
      remark
    } = event

    if (!applicantId || !department || !purpose || !startTime || !vehicleId || !driverId) {
      return { success: false, message: '请填写完整信息' }
    }

    const auth = await checkSubmitPermission(applicantId)
    if (!auth.ok) return auth.response

    const applicantRes = await db.collection('users').doc(applicantId).get()
    const applicant = applicantRes.data
    if (!applicant) {
      return { success: false, message: '申请人不存在' }
    }
    if (applicant.role === 'driver') {
      return { success: false, message: '专职驾驶员不能作为申请人' }
    }

    const driverRes = await db.collection('users').doc(driverId).get()
    const driver = driverRes.data
    if (!driver) {
      return { success: false, message: '请选择有效驾驶员' }
    }

    const vehicleRes = await db.collection('vehicles').doc(vehicleId).get()
    const vehicle = vehicleRes.data
    if (!vehicle) {
      return { success: false, message: '车辆不存在' }
    }
    if (vehicle.status !== 'available') {
      return { success: false, message: '车辆当前不可用，请重新选择' }
    }

    const occupiedRes = await db.collection('applications')
      .where({
        vehicleId,
        status: 'approved'
      })
      .limit(1)
      .get()

    if (occupiedRes.data.length > 0) {
      return { success: false, message: '车辆已被占用，请重新选择' }
    }

    const applicantOpenid = applicant.openid || applicant._openid || ''
    const approverRes = await db.collection('users').where({ role: 'approver' }).get()
    const approver = approverRes.data[0] || { _id: '', name: '待定' }
    const serialNo = 'AP' + Date.now().toString().slice(-8)

    const result = await db.collection('applications').add({
      data: {
        serialNo,
        applicantId,
        applicantName: applicant.name,
        openid: applicantOpenid,
        applicantOpenid,
        department,
        purpose,
        startTime,
        endTime: '',
        vehicleId,
        vehiclePlate,
        driverId,
        driverName: driver.name || driverName || '',
        remark: remark || '',
        status: 'pending',
        approverId: approver._id || '',
        approverName: approver.name || '',
        approveTime: '',
        createTime: db.serverDate()
      }
    })

    return { success: true, message: '提交成功', id: result._id }
  } catch (err) {
    return { success: false, message: '提交失败：' + err.message }
  }
}
