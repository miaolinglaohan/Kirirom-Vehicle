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
    return { success: false, message: '缺少记录ID' }
  }
  
  try {
    const db = cloud.database()
    const recordRes = await db.collection('applications').doc(_id).get()
    const record = recordRes.data

    if (!record) {
      return { success: false, message: '记录不存在' }
    }

    if (record.status === 'approved' && record.vehicleId) {
      await db.collection('vehicles').doc(record.vehicleId).update({
        data: { status: 'available' }
      })
    }

    await db.collection('applications').doc(_id).remove()
    return { success: true, message: '删除成功' }
  } catch (err) {
    return { success: false, message: '删除失败：' + err.message }
  }
}
