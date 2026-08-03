---
title: IOC与AOP
date: 2024-07-10 21:56:14
tags: AOP
category: SpringBoot
---

### IOC

IOC是一种思想，全称叫做Inversion of Control，控制反转，意思是如果有两个对象A依赖于B，把本来A运行时需要主动创建B对象的操作交给IOC容器来帮我们做，创建B对象并注入A，实现了解耦

IOC也可以叫做DI，Dependency Injection，依赖注入，或者说DI是IOC思想的具体实现方式

### AOP

#### 定义

AOP, (Aspect Orient Programming)，面向切面编程，拦截指定方法并对方法进行增强，不修改源代码的情况下给程序动态添加额外功能

- **横切关注点（cross-cutting concerns）**：多个类或对象中的公共行为（如日志记录、事务管理、权限控制、接口限流、接口幂等等）。

- 切面（Aspect）：对横切关注点进行封装的类，实现具体的功能。（切面 = 切入点 + 通知，通俗点就是在什么时机，什么地方，做什么增强）
- 连接点（JoinPoint）：方法调用或方法执行的某个时刻。（能够被拦截的地方，Spring AOP 是基于动态代理的，所以是方法拦截的，每个成员方法都可以称之为连接点）
- 通知（Advice）：切面在某个连接点要执行的操作，有Before，After，AfterReturning，AfterThrowing，Around。在方法执行的什么时机（**when**：方法前/方法后/方法前后）做什么（**what**：增强的功能）
- 切点（Pointcut）：一个表达式，用来匹配哪些连接点需要被切面增强。（在哪些类，哪些方法上切入（**where**））
- 织入（weaving）：把切面加入到对象，并创建出代理对象的过程，这个由 Spring 来完成。

#### 实现

AOP可以通过动态代理或操作字节码实现

对于接口类型的对象，Spring 会使用 JDK 动态代理。JDK 动态代理通过实现与目标对象相同的接口，在代理对象的方法调用前后插入切面逻辑（如日志记录的代码）。对于没有实现接口的类，Spring 会使用 CGLIB（Code Generation Library）动态代理，CGLIB 通过继承目标类并覆盖目标类的方法来实现代理，在覆盖的方法中插入切面逻辑。

### AOP实例

#### 公共字段自动填充

利用AOP实现对数据的一些公共字段如createTime，updateUser等的自动填充功能，无需再手动set

**自定义注解**

```java
/**
 * 自定义注解，用于标识某个方法需要进行公共字段的自动填充
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface AutoFill {
    //数据库操作类型： UPDATE, INSERT
    OperationType value();
}

//枚举定义数据库操作
public enum OperationType {
    UPDATE,//更新操作
    INSERT//插入操作
}
```



**要被填充的方法**

以DishMapper举例

```java
/**
 * 新增菜品
 * @param dish
 */
@AutoFill(OperationType.INSERT)
void insert(Dish dish);
```



**切面类**

实现具体的填充功能

```java
@Aspect //标注这是一个切面类
@Component //加入Spring容器
public class AutoFillAspect {

    //切点
    @Pointcut("execution(* com.sky.map	per.*.*(..)) && @annotation(com.sky.annotation.AutoFill)")
    public void autoFillPointCut() {}

    //通知
    @Before("autoFillPointCut()")//方法调用前执行autoFill方法，
    public void autoFill(JoinPoint joinPoint) { // JoinPoint：连接点
        //获取操作类型
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();//获取方法签名
        AutoFill autoFill = signature.getMethod().getAnnotation(AutoFill.class);//方法上的注解对象
        OperationType type = autoFill.value();//数据库操作类型

        //获取切入点方法的参数列表
        Object[] args = joinPoint.getArgs();
        if (args == null || args.length == 0) {
            return;
        }
        Object entity = args[0]; // 这里就是Dish实体类

        //准备赋值的数据
        LocalDateTime now = LocalDateTime.now();
        Long currentId = BaseContext.getCurrentId();

        //根据操作类型，通过反射为对应的属性赋值
        if (type == OperationType.INSERT) {
            try {
                Method setCreatTime = entity.getClass().getDeclaredMethod(AutoFillConstant.SET_CREATE_TIME,
                        LocalDateTime.class);
                Method setUpdateTime = entity.getClass().getDeclaredMethod(AutoFillConstant.SET_UPDATE_TIME,
                        LocalDateTime.class);
                Method setUpdateUser = entity.getClass().getDeclaredMethod(AutoFillConstant.SET_UPDATE_USER,
                        Long.class);
                Method setCreateUser = entity.getClass().getDeclaredMethod(AutoFillConstant.SET_CREATE_USER,
                        Long.class);

                setCreateUser.invoke(entity, currentId);
                setUpdateUser.invoke(entity, currentId);
                setUpdateTime.invoke(entity, now);
                setCreatTime.invoke(entity, now);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        } else if (type == OperationType.UPDATE) {
            try {
                Method setUpdateTime = entity.getClass().getDeclaredMethod(AutoFillConstant.SET_UPDATE_TIME,
                        LocalDateTime.class);
                Method setUpdateUser = entity.getClass().getDeclaredMethod(AutoFillConstant.SET_UPDATE_USER,
                        Long.class);

                setUpdateUser.invoke(entity, currentId);
                setUpdateTime.invoke(entity, now);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }
    }
}
```

#### 日志记录

定义日志记录切面记录Controller中方法的运行细节

```java
/**
 * 自定义日志注解
 * @author Fu1sh
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface Logger {

    String description() default "";
}
```

```java
@Configuration
@Aspect
@Slf4j
@ConditionalOnClass(DispatcherServlet.class)
public class LoggerAspect {

    //*：匹配任意返回值的方法 
    //com.hmall..controller：匹配包
    //.*.*(..)：匹配包下任意类、任意方法、任意方法参数
    @Pointcut("execution(* com.hmall..controller.*.*(..)) && @annotation(com.hmall.common.annotation.Logger)")
    public void loggerPointCut() {}

    @Around("loggerPointCut()")
    public Object loggerAround(ProceedingJoinPoint joinPoint) {
        HttpServletRequest request = getRequest();
        WebLog webLog;
        Object result = null;
        try {
            log.info("================前置通知===============");
            long start = System.currentTimeMillis();
            //执行拦截的方法
            result = joinPoint.proceed();
            log.info("================返回通知===============");
            long l = System.currentTimeMillis() - start;
            long timeCost = TimeUnit.SECONDS.toSeconds(l);
            Logger logger = getAnnotationLogger(joinPoint);
            webLog = WebLog.builder() //WebLog封装了将要展示的日志信息
                    .description(logger.description())
                    .startTime(start)
                    .timeCost(timeCost)
                    .url(request.getRequestURL().toString())
                    .uri(request.getRequestURI())
                    .ipAddress(request.getRemoteAddr())
                    .params(getParams(joinPoint))
                    .result(result)
                    .build();
            log.info(webLog.toString());
        } catch (Throwable e) {
            log.info("================异常通知===============");
            log.error(e.getMessage(), e);
        } finally {
            log.info("================后置通知===============");
        }
        return result;
    }

    private Object getParams(ProceedingJoinPoint joinPoint) {
        MethodSignature methodSignature = getMethodSignature(joinPoint);
        String[] parameterNames = methodSignature.getParameterNames();
        Object[] parameterValues = joinPoint.getArgs();
        Map<String, Object> params = new HashMap<>();
        for (int i = 0; i < parameterNames.length; i++) {
            params.put(parameterNames[i], parameterValues[i]);
        }
        return params;
    }

    private Logger getAnnotationLogger(ProceedingJoinPoint joinPoint) {
        return getMethodSignature(joinPoint).getMethod().getAnnotation(Logger.class);
    }

    private static MethodSignature getMethodSignature(ProceedingJoinPoint joinPoint) {
        return (MethodSignature) joinPoint.getSignature();
    }

    /**
     * 获取http请求对象
     * @return
     */
    private HttpServletRequest getRequest() {
        ServletRequestAttributes requestAttributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        return requestAttributes != null ? requestAttributes.getRequest() : null;
    }
}
```

```java
@ApiOperation("用户登录接口")
@PostMapping("login")
@Logger(description = "登录") //使用自定义日志注解记录日志信息
public UserLoginVO login(@RequestBody @Validated LoginFormDTO loginFormDTO){
    return userService.login(loginFormDTO);
}
```

> RequestContextHolder是Spring 提供的工具类，它使用ThreadLocal存储当前请求的上下文信息，主要用途是从任意位置获取当前 `ServletRequest` 和其他请求相关的信息，特别是在不直接处理请求的组件（如 `@Service` 或 `@Component`）中。



### AOP失效场景

#### 自调用

AOP 基于代理机制来工作，当一个类的方法在同一个类内部被另一个方法调用时，这种自调用是直接调用的，不会经过代理对象，从而导致切面失效。

#### 目标类未被 Spring 管理

AOP 依赖于 Spring 管理的 Bean，如果目标类不是由 Spring 容器管理的 Bean，则切面不会生效。如果一个类通过 `new` 操作符实例化，而不是通过 Spring 容器注入，那么 AOP 不会生效，因为 Spring 不能为其创建代理对象。

#### final关键字

final修饰的类不能被继承，修饰的方法不能被重写。

**JDK 动态代理**：JDK 动态代理只能代理接口中的方法，而不涉及类的继承，因此 `final` 类和 `final` 方法的限制对 JDK 动态代理没有直接影响。但由于 JDK 动态代理只能代理接口方法，所以如果类没有实现接口，Spring 会默认使用 CGLIB 代理。

**CGLIB 代理**：CGLIB 代理通过生成目标类的子类并重写方法来实现代理。如果类或方法是 `final` 的，CGLIB 代理就无法创建有效的代理对象，因为它无法继承 `final` 类或重写 `final` 方法，这会导致 AOP 切面失效。

#### private方法同理

Spring AOP 仅支持公共方法（`public`）的切面，对于 `private`、`protected` 和 `package-private` 方法，切面不会生效。

```java
@Transactional
private void privateMethod() {
    // 事务逻辑不会生效，因为方法是私有的，无法被重写
}
```
