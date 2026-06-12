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

const db = cloud.database()

exports.main = async (event, context) => {
  const auth = await checkAdmin()
  if (!auth.ok) return auth.response

  try {
    const { plateNumber, type } = event
    if (!plateNumber || !type) {
      return { success: false, message: '请填写完整信息' }
    }
    
    const result = await db.collection('vehicles').add({
      data: {
        plateNumber: plateNumber,
        type: type,
        status: 'available',
        createdAt: db.serverDate()
      }
    })
    
    return { success: true, message: '添加成功', id: result._id }
  } catch (err) {
    return { success: false, message: err.message }
  }
}
