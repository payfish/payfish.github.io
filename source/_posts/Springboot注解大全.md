---
title: SpringBoot注解大全
date: 2024-07-21 20:44:34
tags: Annotation
category: SpringBoot
---

### 前言

SpringBoot注解让我们摆脱了繁琐的Spring XML配置，让我们的开发更加高效，这里对常见的SpringBoot注解做个总结。

### 启动类上

**SpringBootApplication**：申明让spring boot自动给程序进行必要的配置，等同于 `@Configuration` ，``@EnableAutoConfiguration`` 和 ``@ComponentScan`` 三个配置。

- **Configuration**：用在类上，声明该类是配置类，等同于 Spring 的  XML 文件。

- **EnableAutoConfiguration**：启用 SpringBoot 的自动化配置，会根据你在 `pom.xml` 添加的依赖和 `application-dev.yml` 中的配置自动创建你需要的配置。

- **ComponentScan**：启用SpringBoot的组件扫描功能，将自动装配和注入指定包下的Bean实例。

**MapperScan**("mapper接口包路径信息")：扫描指定包下所有的接口类，然后所有接口在编译之后都会生成相应的实现类，也就是针对Mapper进行一个声明。加上这个注解之后，就不用在每个Mapper接口上使用@Mapper注解。

**EnableFeignClients**：扫描指定包下（如果声明了）的使用了注解`@FeignClient`定义的Feign客户端。如 :

>  `@EnableFeignClients(basePackages = "com.hmall.api.client")`

**EnableCaching**：添加Spring Data Redis依赖之后，可用该注解开启Spring基于注解的缓存管理功能。

**EnableOpenApi** ：Swagger 3.0 的启用注解，添加上这个注解之后就可以使用Swagger3.0的Api文档。

**EnableScheduling** ：开启项目对定时任务的支持，此添加该注解之后，Spring容器会自动扫描被 `@Scheduled `注解的方法，被 `@Scheduled` 注解声明的方法为定时任务，在指定的时间进行自动的执行。

**EnableAsync** ：表示项目支持异步方法调用。此添加该注解之后，Spring容器会自动扫描被 `@Async` 注解的方法或者类，对该方法进行异步操作。即该方法和调用者不在一个线程中进行。

**EnableTransactionManagement** ：开启注解方式的事务管理。添加该注解后，Spring容器会自动扫描被 `@Transactional` 注解的方法和类。

>  所有的数据访问技术都有事务处理机制，这些技术提供了API用来开启事务、提交事务以完成数据操纵，或者在发生错误的时候回滚数据。Spring支持声明式事务，这是基于AOP实现的。

- **声明式事务**：指的是通过配置或注解的方式，声明哪些方法应该具有事务性，而不需要在业务代码中手动管理事务（例如，不需要显式地调用 `beginTransaction()`、`commit()` 或 `rollback()` 等方法）。
- Spring 使用 AOP 来拦截被 `@Transactional` 注解的方法，在方法执行前后自动管理事务的开启、提交和回滚。AOP 允许在不修改业务代码的情况下，添加事务管理等横切关注点。

### 组件相关

**Component**：用于修饰SpringBoot中的组件，会被组件扫描并生成实例化对象。`@Controller`、`@Service`、`@Repository`都是特殊的组件注解。

**Controller** ：用于修饰MVC中 `controller` 层的组件，SpringBoot中的组件扫描功能会识别到该注解，并为修饰的类实例化对象，通常与 `@RequestMapping` 联用，当SpringMVC获取到请求时会转发到指定路径的方法进行处理。

**Service**：用于修饰 `service` 层的组件，`service` 层组件专注于系统业务逻辑的处理，同样会被组件扫描并生成实例化对象。

**Repository**：用于修饰 `dao`层的组件，`dao `层组件专注于系统数据的处理，例如数据库中的数据，同样会被组件扫描并生成实例化对象。

**RestController** ：`@Controller` 和 `@ResponseBody` 两个注解的结合体。将类标记为 Spring MVC 控制器，所有的请求处理方法的返回值直接写入 HTTP 响应体中，而不是解析为视图名。

> **ResponseBody**：表示方法将返回JSON格式的数据，会自动将返回的对象转化为JSON数据。

**ConfigurationProperties**：用来拿配置文件中的属性直接加载到bean上。例如 `@ConfigurationProperties(prefix = "hm.jwt")`，还支持以下属性：ignoreInvalidFields（忽略无效字段）、ignoreUnknownFields（忽略未知字段）、conversionService（转换服务）将配置文件中的特定格式的值转换为 Java 对象中的特定类型。binders（绑定器）允许注册自定义的`Binder`对象，用于更复杂的属性绑定场景。

### 实例相关

**Bean**：用于修饰方法，标识该方法会创建一个Bean实例，并交给Spring容器来管理。

#### Component 和 Bean 的区别

- Component作用在类上，Bean作用在方法上

- Component注解表明一个类会作为组件类，并告知Spring要为这个类创建bean。

- Bean注解告诉Spring这个方法将会返回一个对象，这个对象要注册为Spring应用上下文中的bean。通常方法体中包含了最终产生bean实例的逻辑。

- `@Bean` 必须声明在 `@Configuration` 注解修饰的类中的方法上 

- `@Bean` 注解比 `@Component` 注解的自定义性更强，而且很多地方只能通过 `@Bean` 注解来注册bean。比如当引用第三方库的类需要装配到Spring容器的时候，就只能通过 `@Bean` 注解来实现。

  

### 依赖注入

**Autowired**：会根据对象的**类型**自动注入依赖对象，默认要求注入对象实例必须存在，可以配置 `required = false` 来注入不一定存在的对象。

**Resource**：默认会根据对象的**名称**自动注入依赖对象，如果想要根据类型进行注入，可以设置 `type` 属性。

#### @Resource注入异常记录

一个项目中使用@Resource注入StringRedisTemplate的时候，实例名称写成了redisTemplate，直接报错

```@Resource
@Resource
private StringRedisTemplate redisTemplate;
```

> Bean named 'redisTemplate' is expected to be of type 'org.springframework.data.redis.core.StringRedisTemplate' but was actually of type 'org.springframework.data.redis.core.RedisTemplate'

回头一查才发现早已在这里对比过这两个注解的区别，记录一下加深印象



**Qualifier**：当同一个对象有多个实例可以注入时，使用 `@Autowired `注解无法进行注入，这时可以使用 `@Qualifier` 注解指定实例的名称进行精确注入。



### SpringMVC相关

**PathVariable("id")**：处理请求 url 路径中的参数 /user/5

**RequestParam**：处理问号后面的参数，可以是如下三种形式：

- query param：GET请求拼接在地址里的参数。
- form data：POST表单提交的参数。
- multipart：文件上传请求的部分参数。

**RequestBody**：表示方法的请求参数为JSON格式，从Body中传入，将自动绑定到方法参数对象中。

> @Valid注解用于数据验证，可以确保传入对象或返回对象符合预定义的约束规则

```java
@ApiOperation("添加商品到购物车")
@PostMapping
public void addItem2Cart(@Valid @RequestBody CartFormDTO cartFormDTO){
    cartService.addItem2Cart(cartFormDTO);
}

@Data
@ApiModel(description = "新增购物车商品表单实体")
public class CartFormDTO {
    @ApiModelProperty("商品id")
    private Long itemId;
    @ApiModelProperty("商品标题")
    private String name;
    @ApiModelProperty("商品动态属性键值集")
    private String spec;
    @ApiModelProperty("价格,单位：分")
    private Integer price;
    @ApiModelProperty("商品图片")
    private String image;
}
```

**ResponseBody**：表示方法将返回JSON格式的数据，会自动将返回的对象转化为JSON数据。

**RequestMapping**：当作用于类上时，可以统一类中所有方法的路由路径，当作用于方法上时，可单独指定方法的路由路径。

> `method`属性可以指定请求的方式，如GET、POST、PUT、DELETE等。

**PostMapping**：主要用于创建资源。

**PutMapping**：主要用于更新资源。

> **幂等性**：

- `POST` 请求不是幂等的，重复相同的 POST 请求可能会创建多个资源。
- `PUT` 请求是幂等的，重复相同的 PUT 请求不会改变资源的状态。
- `GET` 请求是幂等的，重复相同的 GET 请求不会改变资源的状态。

> 可以对所有幂等的请求做缓存

- 通常只对GET请求的响应做缓存，因为PUT和DELETE均涉及到修改操作，缓存其响应没有太大意义
- 缓存需要有合适的过期策略，以确保数据的新鲜度。
- 当资源更新时，需要确保缓存的数据也及时更新，以避免缓存不一致的问题。
