const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

async function checkAdmin() {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()

  const userRes = await db.collection('users')
    .where({ openid: wxContext.OPENID })
    .limit(1)
    .get()

  const user = userRes.data[0]

  if (!user || user.role !== 'admin') {
    return {
      ok: false,
      response: {
        success: false,
        message: '无权限，仅管理员可操作'
      }
    }
  }

  return {
    ok: true,
    user
  }
}

exports.main = async (event, context) => {
  const auth = await checkAdmin()
  if (!auth.ok) return auth.response

  const { _id, vehicleId, vehiclePlate, purpose, startTime, endTime } = event

  if (!_id || !vehicleId || !vehiclePlate || !purpose || !startTime) {
    return { success: false, message: '参数不完整' }
  }

  const db = cloud.database()

  try {
    const recordRes = await db.collection('applications').doc(_id).get()
    const record = recordRes.data

    if (!record) {
      return { success: false, message: '记录不存在' }
    }

    const vehicleRes = await db.collection('vehicles').doc(vehicleId).get()
    const vehicle = vehicleRes.data

    if (!vehicle) {
      return { success: false, message: '车辆不存在' }
    }

    const oldVehicleId = record.vehicleId || ''
    const vehicleChanged = oldVehicleId !== vehicleId

    if (record.status === 'approved' && vehicleChanged && vehicle.status !== 'available') {
      return { success: false, message: '新车辆当前不可用，无法保存' }
    }

    const updateData = {
      vehicleId,
      vehiclePlate,
      purpose,
      startTime,
      endTime: endTime || '',
      updateTime: db.serverDate()
    }

    if (endTime !== undefined) {
      updateData.actualEndTime = endTime || ''
    }

    await db.collection('applications').doc(_id).update({
      data: updateData
    })

    if (record.status === 'approved' && vehicleChanged) {
      if (oldVehicleId) {
        await db.collection('vehicles').doc(oldVehicleId).update({
          data: { status: 'available' }
        })
      }

      await db.collection('vehicles').doc(vehicleId).update({
        data: { status: 'in_use' }
      })
    }

    return { success: true, message: '修改成功' }
  } catch (err) {
    return { success: false, message: '修改失败：' + err.message }
  }
}
