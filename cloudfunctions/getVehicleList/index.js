const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const availableVehiclesRes = await db.collection('vehicles').where({ status: 'available' }).get()
    const approvedApplicationsRes = await db.collection('applications').where({ status: 'approved' }).get()

    const occupiedVehicleIds = approvedApplicationsRes.data
      .map(item => item.vehicleId)
      .filter(Boolean)

    const occupiedVehicleIdSet = new Set(occupiedVehicleIds)
    const availableVehicles = availableVehiclesRes.data.filter(vehicle => {
      return !occupiedVehicleIdSet.has(vehicle._id)
    })

    return { success: true, data: availableVehicles }
  } catch (err) {
    return { success: false, message: err.message }
  }
}
