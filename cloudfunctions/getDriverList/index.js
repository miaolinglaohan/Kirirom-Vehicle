const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function checkRegisteredUser() {
  const wxContext = cloud.getWXContext()
  const userRes = await db.collection('users')
    .where({ openid: wxContext.OPENID })
    .limit(1)
    .get()

  const user = userRes.data[0]
  if (!user) {
    return {
      ok: false,
      response: {
        success: false,
        message: '用户未登记，请联系管理员'
      }
    }
  }

  return { ok: true, user }
}

exports.main = async () => {
  const auth = await checkRegisteredUser()
  if (!auth.ok) return auth.response

  try {
    const res = await db.collection('users')
      .field({
        _id: true,
        name: true,
        department: true,
        role: true
      })
      .get()

    const data = (res.data || []).sort((a, b) => {
      const an = a.name || ''
      const bn = b.name || ''
      return an.localeCompare(bn, 'zh-CN')
    })

    return { success: true, data }
  } catch (err) {
    return { success: false, message: err.message }
  }
}
