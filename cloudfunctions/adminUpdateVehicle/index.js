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

  const { _id, plateNumber, type, status } = event
  
  if (!_id || !plateNumber || !type) {
    return { success: false, message: '参数不完整' }
  }
  
  const db = cloud.database()
  
  const updateData = {
    plateNumber,
    type,
    updateTime: db.serverDate()
  }
  
  if (status) {
    updateData.status = status
  }
  
  await db.collection('vehicles').doc(_id).update({
    data: updateData
  })
  
  return { success: true, message: '更新成功' }
}
