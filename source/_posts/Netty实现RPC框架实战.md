---
title: Netty实现RPC框架实战
date: 2024-07-03 21:53:48
tags: Netty
category: 造轮子
---

### 深入Netty

#### ByteBuf

Netty并未使用NIO中的ByteBuffer来作为缓冲区，而是自定义了一个ByteBuf，相比于ByteBuffer有如下区别：

- 写操作完成后无需filp
- 比ByteBuffer响应更快
- 动态扩容

```java
public abstract class AbstractByteBuf extends ByteBuf {
    ...
    int readerIndex;   //index被分为了读和写，是两个指针在同时工作
    int writerIndex; //双指针取代position指针，无需flip将position置0
    private int markedReaderIndex;    //mark操作也分两种
    private int markedWriterIndex;
    private int maxCapacity;    //最大容量，没错，这玩意能动态扩容
```

```java
ByteBuf buffer = Unpooled.buffer(10); //非池化缓冲区
ByteBufAllocator allocator = PooledByteBufAllocator.DEFAULT;//池化技术可以复用buffer
ByteBuf buffer = allocator.buffer(256);
byteBuf.writeBytes("abcdefgrfrfrf".getBytes()); //超过缓冲区大小动态扩容，先到64，之后再每次X2
```

#### 零拷贝

零拷贝允许在计算机内部传输数据时快速高效地将数据从文件系统移动到网络接口，避免将数据从一个存储区域复制到另一个存储区域，从而减少 CPU 负载和内存带宽的消耗。

其实早期操作系统是不区分内核空间和用户空间的，但是应用程序能访问任意内存空间，程序很容易不稳定，常常把系统搞崩溃，比如清除操作系统的内存数据。实际上让应用程序随便访问内存真的太危险了，于是就按照CPU 指令的重要程度对指令进行了分级，指令分为四个级别：Ring0 ~ Ring3，Linux 下只使用了 Ring0 和 Ring3 两个运行级别，进程运行在 Ring3 级别时运行在用户态，指令只访问用户空间，而运行在 Ring0 级别时被称为运行在内核态，可以访问任意内存空间。

![](状态切换.png)

比如Java创建线程，实际上是通过调用本地方法``private native void start0();``来启动线程，它使用 JNI 调用操作系统的线程创建函数 `CreateThread` （这个就叫系统调用），这个过程就涉及到用户态到内核态的切换，操作系统内核负责分配资源（如栈、线程控制块等），并将新线程加入调度队列。

我们的文件操作也是如此，操作系统帮我们从磁盘读取到文件中的数据发给网络，流程如下

![](文件IO.png)

DMA控制器就是Direct Memory Access，CSGO经常听到的DMA硬件外挂就是通过FPGA硬件设备直接访问内存，修改内存数据达到控制游戏操作的效果。图中经历了两次CPU拷贝两次DMA拷贝，拷贝略多，可以使用零拷贝优化。

**使用零拷贝技术**

- **mmap/munmap**：通过内存映射文件，可以将文件内容映射到进程的地址空间，这样读写文件就像读写内存一样，无需经过用户态的缓冲区。

- **sendfile**：系统调用 `sendfile` 允许直接将数据从一个文件描述符传输到另一个文件描述符（例如，从文件到网络套接字），避免在用户态和内核态之间进行数据拷贝。在内核空间中直接由CPU把数据拷贝到Socket。
- **虚拟内存**：现在的操作系统基本都是支持虚拟内存的，我们可以让内核空间和用户空间的虚拟地址指向同一个物理地址，这样就相当于是直接共用了这一块区域，也就谈不上拷贝操作了：





### 基于Netty的RPC框架

#### NettyServer和NettyClient

```java
public class NettyServer implements RpcServer{

    private static final Logger logger = LoggerFactory.getLogger(NettyServer.class);

    @Override
    public void start(int port) {
        EventLoopGroup bossGroup = new NioEventLoopGroup();
        EventLoopGroup workerGroup = new NioEventLoopGroup();
        try {
            ServerBootstrap bootstrap = new ServerBootstrap();
            bootstrap.group(bossGroup, workerGroup)
                    .channel(NioServerSocketChannel.class)
                    .handler(new LoggingHandler(LogLevel.INFO))
                    .childHandler(new ChannelInitializer<SocketChannel>() {
                        @Override
                        protected void initChannel(SocketChannel ch) throws Exception {
                            ch.pipeline().addLast(new CommonDecoder())
                                    .addLast(new CommonEncoder(new JsonSerializer()))
                                    .addLast(new NettyServerHandler());
                        }
                    })
                    .option(ChannelOption.SO_BACKLOG, 128)
                    .childOption(ChannelOption.SO_KEEPALIVE, true);
            ChannelFuture future = bootstrap.bind(port).sync();
            future.channel().closeFuture().sync();
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        } finally {
            bossGroup.shutdownGracefully();
            workerGroup.shutdownGracefully();
        }
    }
}

public class NettyClient implements RpcClient{

    private static final Logger logger = LoggerFactory.getLogger(NettyClient.class);

    private String host;
    private int port;
    private static final Bootstrap bootstrap;

    public NettyClient(String host, int port) {
        this.host = host;
        this.port = port;
    }

    static { //在静态代码块中先配置好客户端
        bootstrap = new Bootstrap();
        bootstrap.group(new NioEventLoopGroup())
        .channel(NioSocketChannel.class)

        .handler(new ChannelInitializer<SocketChannel>() {
            @Override
            protected void initChannel(SocketChannel ch) throws Exception {
                ch.pipeline().addLast(new CommonDecoder())
                        .addLast(new CommonEncoder(new JsonSerializer()))
                        .addLast(new NettyClientHandler());
            }
        });
    }

    @Override
    public Object sendRequest(RpcRequest request) {
        try {
            ChannelFuture future = bootstrap.connect(host, port).sync();
            logger.info("客户端连接到服务器：{}，{}", host, port);
            Channel channel = future.channel();
            if (channel.isActive()) {
                channel.writeAndFlush(request).addListener(future1 -> {
                    if (future1.isSuccess()) {
                        logger.info("客户端发送消息：{}", request.toString());
                    } else {
                        logger.error("发送消息时有错误发生，{}", future1.cause().getMessage());
                    }
                });
            }
            //阻塞等待直到channel关闭
            channel.closeFuture().sync();
            AttributeKey<RpcResponse> attributeKey = AttributeKey.valueOf("rpcResponse");
            RpcResponse rpcResponse = channel.attr(attributeKey).get();
            return rpcResponse.getData();
        } catch (InterruptedException e) {
            logger.error("发送消息时有错误发生：", e);
        }
        return null;
    }
}
```



#### 编码与解码

首先自定义通信协议

```
魔数（int）4字节|数据包类型（int）4字节|序列化器类型（int）4字节|消息长度（int）4字节|消息体
```

```java
public class CommonEncoder extends MessageToByteEncoder { //编码器

    private static final int MAGIC_NUMBER = 0xCAFEBABE;
    private final CommonSerializer serializer;

    public CommonEncoder(CommonSerializer serializer) {
        this.serializer = serializer;
    }

    //自定义协议：魔数（int）4字节|数据包类型|序列化器类型|消息长度|消息体
    @Override
    protected void encode(ChannelHandlerContext ctx, Object o, ByteBuf byteBuf) throws Exception {
        byteBuf.writeInt(MAGIC_NUMBER);
        if (o instanceof RpcRequest) {
            byteBuf.writeInt(PackageType.REQUEST_PACK.getCode());
        } else {
            byteBuf.writeInt(PackageType.RESPONSE_PACK.getCode());
        }
        byteBuf.writeInt(serializer.getCode());
        byte[] bytes = serializer.serialize(o);
        int len = bytes.length;
        byteBuf.writeInt(len);
        byteBuf.writeBytes(bytes);
    }
}

public class CommonDecoder extends ReplayingDecoder {

    private static final Logger logger = LoggerFactory.getLogger(CommonDecoder.class);
    private static final int MAGIC_NUMBER = 0xCAFEBABE;

    @Override
    protected void decode(ChannelHandlerContext channelHandlerContext, ByteBuf byteBuf, List<Object> list) throws Exception {
        int magic = byteBuf.readInt();
        if (magic != MAGIC_NUMBER) {
            logger.error("Invalid magic number! {}", magic);
            throw new RpcException(RpcError.UNKNOWN_MAGIC_NUMBER);
        }
        int packageCode = byteBuf.readInt();
        Class<?> packageClass;
        if (packageCode == PackageType.REQUEST_PACK.getCode()) {
            packageClass = RpcRequest.class;
        } else if (packageCode == PackageType.RESPONSE_PACK.getCode()) {
            packageClass = RpcResponse.class;
        } else {
            logger.error("Invalid package type! {}", packageCode);
            throw new RpcException(RpcError.UNKNOWN_PACK_TYPE);
        }
        int serializeCode = byteBuf.readInt();
        CommonSerializer serializer = CommonSerializer.getByCode(serializeCode);
        if (serializer == null) {
            logger.error("Invalid serialize code! {}", serializeCode);
            throw new RpcException(RpcError.UNKNOWN_SERIAL_CODE);
        }
        int len = byteBuf.readInt();
        byte[] data = new byte[len];
        byteBuf.readBytes(data);
        Object o = serializer.deserialize(data, packageClass);
        list.add(o);
    }
}
```

编码器解码器都是继承自``ChannelInboundHandlerAdapter``入站处理器类。其中解码器继承的ReplayingDecoder是``ByteToMessageDecoder``的子类，简化了数据解码的逻辑，可以自动处理缓冲区的读取操作，如果数据不足，它会自动暂停解码并等待更多的数据。而``ByteToMessageDecoder``需要手动检查可读字节，并决定是否有足够的数据来解码一条完整的消息。

#### 序列化

##### Jdk序列化

JDK Serializable是Java自带的序列化框架，我们只需要实现java.io.Serializable或java.io.Externalizable接口，就可以使用Java自带的序列化机制。实现序列化接口只是表示该类能够被序列化/反序列化，我们还需要借助I/O操作的ObjectInputStream和ObjectOutputStream对对象进行序列化和反序列化。

由于是Java内置序列化框架，所以本身是不支持跨语言序列化与反序列化。

JDK Serializable中通过serialVersionUID控制序列化类的版本，如果序列化与反序列化版本不一致，则会抛出java.io.InvalidClassException异常信息，提示序列化与反序列化SUID不一致。

##### Json序列化器

基于JSON字符串，占用空间大，速度慢

```java
public class JsonSerializer implements CommonSerializer{

    private static final Logger logger = LoggerFactory.getLogger(JsonSerializer.class);
    private ObjectMapper mapper = new ObjectMapper();

    @Override
    public byte[] serialize(Object obj) {
        byte[] bytes;
        try {
            bytes = mapper.writeValueAsBytes(obj);
        } catch (JsonProcessingException e) {
            logger.error("Json serialize error", e);
            return null;
        }
        return bytes;
    }

    @Override
    public Object deserialize(byte[] bytes, Class<?> clazz) {
        Object obj;
        try {
            obj = mapper.readValue(bytes, clazz);
            if (obj instanceof RpcRequest) {
                obj = handleRequest(obj);
            }
            return obj;
        } catch (IOException e) {
            logger.error("Json deserialize error", e);
            return null;
        }
    }
    
	 /**
     * 解决反序列化RpcRequest的Object[] params数组中的元素前后不一致的问题
     * @param obj
     * @return
     * @throws IOException
     */
    private Object handleRequest(Object obj) throws IOException {
        RpcRequest rpcRequest = (RpcRequest) obj;
        for(int i = 0; i < rpcRequest.getParamTypes().length; i ++) {
            Class<?> clazz = rpcRequest.getParamTypes()[i];
            if(!clazz.isAssignableFrom(rpcRequest.getParams()[i].getClass())) {
                byte[] bytes = mapper.writeValueAsBytes(rpcRequest.getParams()[i]);
                rpcRequest.getParams()[i] = mapper.readValue(bytes, clazz);
            }
        }
        return rpcRequest;
    }
    
    @Override
    public int getCode() {
        return SerializerCode.JSON_SERIALIZER.getCode();
    }
}
```

RpcRequest 反序列化时，由于其中有一个字段是 Object 数组，在反序列化时序列化器会根据字段类型进行反序列化，而 Object 就是一个十分模糊的类型，会出现反序列化失败的现象, 通常会直接反序列化成string类型：

客户端日志：

> [com.fu1sh.rpc.client.NettyClient]-客户端发送消息：RpcRequest(interfaceName=com.fu1sh.rpc.api.Animal, methodName=eat, params=[**Food**(name=猪食, price=30)], paramTypes=[class com.fu1sh.rpc.api.Food])

服务端日志：可见反序列化搞丢了Food类型

> [com.fu1sh.rpc.handler.NettyServerHandler]-接收到客户端请求：RpcRequest(interfaceName=com.fu1sh.rpc.api.Animal, methodName=eat, params=[{name=猪食, price=30}], paramTypes=[class com.fu1sh.rpc.api.Food])

这时就需要 RpcRequest 中的另一个字段 ParamTypes 来获取到 Object 数组中的每个实例的实际类，辅助反序列化。

##### Kryo序列化器

基于字节，空间利用率高；序列化时记录属性对象的类型信息

kryo使用 Input 和 Output 类来操作数据进出Kryo， 这些类并不是线程安全的。所以通常使用ThreadLocal来为每个需要序列化操作的线程存储一个kryo变量。

```java
private static final ThreadLocal<Kryo> kryoThreadLocal = ThreadLocal.withInitial(() -> {
    Kryo kryo = new Kryo();
    kryo.register(RpcRequest.class);
    kryo.register(RpcResponse.class);
    return kryo;
});
```

```java
@Override
public byte[] serialize(Object obj) {
    try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
    Output output = new Output(baos)) {
        Kryo kryo = kryoThreadLocal.get();
        kryo.writeObject(output, obj);
        kryoThreadLocal.remove(); //移除当前线程kryo局部变量防止内存泄漏
        return output.toBytes();
    } catch (IOException e) {
        logger.error("kryo serialize error", e);
        return null;
    }
}

@Override
public Object deserialize(byte[] bytes, Class<?> clazz) {
    try (ByteArrayInputStream bais = new ByteArrayInputStream(bytes);
    Input input = new Input(bais)) {
        Kryo kryo = kryoThreadLocal.get();
        Object o = kryo.readObject(input, clazz);
        kryoThreadLocal.remove();
        return o;
    } catch (Exception e) {
        logger.error("kryo deserialize error", e);
        return null;
    }
}
```

#### 动态代理

```java
public class RpcClientProxy implements InvocationHandler {

    private RpcClient rpcClient;

    public RpcClientProxy(RpcClient rpcClient) {
        this.rpcClient = rpcClient;
    }
    
    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        RpcRequest request = new RpcRequest(method.getDeclaringClass().getName(), method.getName()
                ,args ,method.getParameterTypes());
        return this.rpcClient.sendRequest(request);
    }

    @SuppressWarnings("unchecked")
    public <T> T getProxy(Class<T> clazz) {
        return (T) Proxy.newProxyInstance(clazz.getClassLoader(), new Class[]{clazz}, this);
    }

}
```

动态代理的 ``invoke`` 方法封装了对接口方法的调用，将这些调用统一封装成 ``RpcRequest`` 对象，然后通过 `rpcClient.sendRequest` 发送，调用者不需要关注底层实现细节

动态代理同时提供了灵活性，能够在运行时动态地创建代理对象并处理接口方法的调用，可以方便地扩展和修改请求的处理逻辑，例如在 `invoke` 方法中添加日志记录、性能监控、权限检查等。
