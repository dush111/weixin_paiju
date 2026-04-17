const cloud = require('wx-server-sdk')
const QRCode = require('qrcode')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { text } = event
  
  if (!text) {
    return { success: false, message: '缺少text参数' }
  }

  try {
    const qrBase64 = await QRCode.toDataURL(text, {
      width: 200,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })
    
    return {
      success: true,
      data: qrBase64
    }
  } catch (err) {
    console.error('生成二维码失败:', err)
    return { success: false, message: '生成二维码失败' }
  }
}
