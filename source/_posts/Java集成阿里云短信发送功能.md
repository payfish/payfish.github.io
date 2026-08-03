---
title: Java集成阿里云短信发送功能
date: 2024-08-26 21:38:56
tags: 阿里云
category: Java

---

### 阿里云获取服务

首先进入此链接[短信服务](https://dysms.console.aliyun.com/overview)

按照如下图的快速学习一步一步走完即可，其中系统设置可以不管

![](微信截图_20240826214110.png)

- 签名：短信开头的发信人信息，如【中国移动】
- 模板：短信内容，如 您的验证码为：${code}，该验证码5分钟内有效，请勿泄露于他人！

### 购买套餐

[云通信精选特惠](https://www.aliyun.com/activity/daily/cloudcommunication-daily?spm=5176.8195934.J_5834642020.2.57c44378vlMpzG)这个链接有200条2元的套餐，测试学习必备

### 导入依赖

```xml
<dependency>
    <groupId>com.aliyun</groupId>
    <artifactId>aliyun-java-sdk-core</artifactId>
    <version>3.2.6</version>
</dependency>
<dependency>
    <groupId>com.aliyun</groupId>
    <artifactId>aliyun-java-sdk-dysmsapi</artifactId>
    <version>1.1.0</version>
</dependency>
```

### Java代码

> 新建一个SmsUtil工具类

```java
@Slf4j
@Component
public class SmsUtil {
    // 签名
    private static final String signName = "中国移动";
    // 模板
    private static final String templateCode = "SMS_********";
    // 你的accessKeyId
    private static final String accessKeyId = "LTAI5*****************ekr";
    // 你的accessKeySecret
    private static final String accessKeySecret = "BH*************************D";
    // 区域
    private static final String REGION_ID = "cn-chengdu";
    // 阿里云短信默认配置信息，固定
    private static final String PRODUCT = "Dysmsapi";
    private static final String DOMAIN = "dysmsapi.aliyuncs.com";

    /**
     * 发送验证码
     * @param mobile 手机号
     * @param code 验证码
     * @return 执行结果
     */
    public boolean sendSMS(String mobile, String code) {
        try {
            IClientProfile profile = DefaultProfile.getProfile(REGION_ID, accessKeyId, accessKeySecret);

            DefaultProfile.addEndpoint(REGION_ID, REGION_ID, PRODUCT, DOMAIN);

            IAcsClient acsClient = new DefaultAcsClient(profile);

            SendSmsRequest request = new SendSmsRequest();

            request.setMethod(MethodType.POST);

            // 手机号可以单个也可以多个（多个用逗号隔开，如：15*******13,13*******27,17*******56）
            request.setPhoneNumbers(mobile);

            request.setSignName(signName);

            request.setTemplateCode(templateCode);
            request.setTemplateParam("{\"code\":\""+ code +"\"}");

            SendSmsResponse sendSmsResponse = acsClient.getAcsResponse(request);
            if ((sendSmsResponse.getCode() != null) && (sendSmsResponse.getCode().equals("OK"))) {
                log.info("发送成功,code:" + sendSmsResponse.getCode());
                return true;
            } else {
                log.info("发送失败,code:" + sendSmsResponse.getCode());
                return false;
            }
        } catch (ClientException e) {
            log.error("发送失败,系统错误！", e);
            return false;
        }
    }
}
```

> 调用服务

```java
//注入SmsUtil
@Resource
private SmsUtil smsUtil;

@Override
public Result sendCode(String phone) {
    //校验手机号
    boolean phoneInvalid = RegexUtils.isPhoneInvalid(phone);
    if (phoneInvalid) {
        return Result.fail("请输入正确的手机号！");
    }
    //生成验证码
    String code = RandomUtil.randomNumbers(6);

    //保存验证码到redis
    stringRedisTemplate.opsForValue().set(LOGIN_CODE_KEY + phone, code, LOGIN_CODE_TTL, TimeUnit.MINUTES);

    //发送验证码，使用阿里云
    boolean sendSMS = smsUtil.sendSMS(phone, code);
    if (sendSMS) {
        log.info("发送验证码成功,手机号{}，验证码{}", phone, code);
    } else {
        log.error("发送验证码失败!");
    }
    return Result.ok();
}
```
