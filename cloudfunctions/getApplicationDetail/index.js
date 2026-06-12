const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()
  const { id } = event

  try {
    if (!id) {
      return { code: -1, message: '缺少记录ID' }
    }

    const userRes = await db.collection('users').where({
      openid: wxContext.OPENID
    }).limit(1).get()

    const user = userRes.data[0]
    if (!user) {
      return { code: -1, message: '用户未登记，请联系管理员' }
    }

    const recordRes = await db.collection('applications').doc(id).get()
    const record = recordRes.data

    return { code: 0, data: record }
  } catch (err) {
    return { code: -1, message: err.message }
  }
}
