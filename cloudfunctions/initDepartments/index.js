const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  // 要创建的8个部门
  const departments = [
    { name: '项目部', sort: 1 },
    { name: '分公司', sort: 2 },
    { name: '综合部', sort: 3 },
    { name: '运检部', sort: 4 },
    { name: '枢纽部', sort: 5 },
    { name: '安全部', sort: 6 },
    { name: '财务部', sort: 7 },
    { name: '其他', sort: 8 }
  ]
  
  try {
    // 直接添加，集合不存在会自动创建
    const tasks = departments.map(dept => 
      db.collection('departments').add({ data: dept })
    )
    await Promise.all(tasks)
    
    return { 
      success: true, 
      message: '部门初始化成功', 
      count: departments.length 
    }
  } catch (err) {
    return { success: false, message: err.message }
  }
}