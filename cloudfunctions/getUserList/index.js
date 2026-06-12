const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function checkCanViewUsers() {
  const wxContext = cloud.getWXContext()

  const userRes = await db.collection('users')
    .where({ openid: wxContext.OPENID })
    .limit(1)
    .get()

  const user = userRes.data[0]

  if (!user || (user.role !== 'admin' && user.role !== 'approver')) {
    return {
      ok: false,
      response: {
        success: false,
        message: '无权限获取用户列表'
      }
    }
  }

  return {
    ok: true,
    user
  }
}

exports.main = async (event, context) => {
  try {
    const auth = await checkCanViewUsers()
    if (!auth.ok) return auth.response

    const res = await db.collection('users').field({ _id: true, name: true, department: true, role: true }).get()
    return { success: true, data: res.data }
  } catch (err) {
    return { success: false, message: err.message }
  }
}
