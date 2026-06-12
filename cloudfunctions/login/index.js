const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  const db = cloud.database()
  
  try {
    const userRes = await db.collection('users')
      .where({ openid: openid })
      .get()
    
    if (userRes.data.length > 0) {
      const user = userRes.data[0]
      return {
        success: true,
        isRegistered: true,
        userInfo: {
          _id: user._id,
          name: user.name,
          department: user.department,
          role: user.role,
          openid: user.openid
        }
      }
    } else {
      return {
        success: true,
        isRegistered: false,
        openid: openid,
        message: '该微信用户尚未登记，请联系管理员添加'
      }
    }
  } catch (err) {
    return { success: false, message: '登录查询失败：' + err.message }
  }
}