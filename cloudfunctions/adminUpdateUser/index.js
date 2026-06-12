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

  const { _id, name, department, role, openid } = event
  
  if (!_id || !name || !department || !role) {
    return { success: false, message: '参数不完整' }
  }
  
  const db = cloud.database()
  
  const updateData = {
    name,
    department,
    role,
    updateTime: db.serverDate()
  }
  
  // 如果传了 openid，一并更新（用于后台绑定微信）
  if (openid !== undefined) {
    if (openid) {
      const exist = await db.collection('users').where({ openid }).get()
      const bindToOtherUser = exist.data.some(user => user._id !== _id)
      if (bindToOtherUser) {
        return { success: false, message: '该微信用户已绑定其他账号' }
      }
    }
    updateData.openid = openid
  }
  
  await db.collection('users').doc(_id).update({
    data: updateData
  })
  
  return { success: true, message: '更新成功' }
}
