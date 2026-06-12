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

  const { name, department, role, openid } = event
  
  if (!name || !department || !role) {
    return { success: false, message: '请填写完整信息' }
  }
  
  const db = cloud.database()
  
  // 如果传了 openid，检查是否已绑定过别人
  if (openid) {
    const exist = await db.collection('users').where({ openid }).get()
    if (exist.data.length > 0) {
      return { success: false, message: '该微信用户已绑定其他账号' }
    }
  }
  
  // 检查同部门同名是否已存在
  const nameExist = await db.collection('users')
    .where({ name, department })
    .get()
  if (nameExist.data.length > 0) {
    return { success: false, message: '该部门已存在同名用户' }
  }
  
  await db.collection('users').add({
    data: {
      name,
      department,
      role,
      openid: openid || '',  // 没传就留空，以后编辑时再绑定
      createTime: db.serverDate()
    }
  })
  
  return { success: true, message: '添加成功' }
}
