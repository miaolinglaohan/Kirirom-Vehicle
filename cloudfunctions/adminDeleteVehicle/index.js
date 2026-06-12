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

  const { _id } = event
  
  if (!_id) {
    return { success: false, message: '缺少车辆ID' }
  }
  
  const db = cloud.database()
  
  // 检查该车辆是否有未完成的用车申请
  const apps = await db.collection('applications')
    .where({ 
      vehicleId: _id,
      status: db.command.in(['pending', 'approved'])
    })
    .count()
  
  if (apps.total > 0) {
    return { success: false, message: '该车辆有未完成的用车申请，无法删除' }
  }
  
  await db.collection('vehicles').doc(_id).remove()
  
  return { success: true, message: '删除成功' }
}
