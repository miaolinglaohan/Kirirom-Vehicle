const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const callerOpenid = wxContext.OPENID
  const { filter, type, applicantId, page = 1, pageSize = 5 } = event
  const db = cloud.database()
  
  let where = {}
  
  // 1. 查调用者身份
  let isRegistered = false
  let userId = ''
  try {
    const userRes = await db.collection('users').where({ openid: callerOpenid }).get()
    if (userRes.data.length > 0) {
      isRegistered = true
      userId = userRes.data[0]._id
    }
  } catch (e) {}
  
  // 2. 未注册用户：任何情况都看不到记录
  if (!isRegistered) {
    return {
      success: true,
      data: [],
      total: 0,
      page: page,
      pageSize: pageSize,
      hasMore: false
    }
  }
  
  // 3. 已注册用户点"我的申请"：只看自己的
  if (type === 'my') {
    const orConditions = [
      { openid: callerOpenid },
      { applicantOpenid: callerOpenid }
    ]
    if (userId) {
      orConditions.push({ applicantId: userId })
    }
    where.$or = orConditions
  }
  
  // 4. 处理前端传来的 filter（如 status: 'pending'）
  if (filter && typeof filter === 'object') {
    Object.keys(filter).forEach(key => {
      if (filter[key] !== undefined && filter[key] !== null && filter[key] !== '') {
        if (key === 'status' && filter[key] === 'approved') {
          where[key] = db.command.in(['approved', 'returned'])
        } else {
          where[key] = filter[key]
        }
      }
    })
  }
  
  try {
    const skip = (page - 1) * pageSize
    const countResult = await db.collection('applications').where(where).count()
    const total = countResult.total
    const res = await db.collection('applications')
      .where(where)
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    
    return {
      success: true,
      data: res.data,
      total: total,
      page: page,
      pageSize: pageSize,
      hasMore: skip + res.data.length < total
    }
  } catch (err) {
    return { success: false, message: err.message }
  }
}
