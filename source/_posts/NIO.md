---
title: NIO
date: 2024-07-01 19:00:42
tags: NIO
category: NIO
---



### 同步异步

**同步**（Synchronous）：同步任务按顺序执行，一个任务完成后才开始下一个任务。调用方在等待任务完成时会被阻塞，直到任务结束并返回结果。

**异步**（Asynchronous）：异步任务可以同时执行，不必等待前一个任务完成。调用方在任务开始后立即返回，可以继续执行其他任务，不会被阻塞。结果通常通过回调、事件或Promise等方式处理。



### 阻塞、非阻塞

**阻塞**：当一个线程在等待某个条件满足（如I/O操作完成、锁释放等）时，它会被挂起（阻塞）并暂停执行，直到条件满足。系统会将其置于等待队列中，直到阻塞条件解除。

**非阻塞**：当一个线程在等待某个条件满足时，它不会被挂起，而是立即返回一个状态（如成功、失败、或需要重试），线程可以继续处理其他任务或尝试再次执行未完成的任务。



### 同步阻塞、非阻塞

#### **同步阻塞（BIO）**

以流的方式处理数据，底层是字节流。

```java
//socket通信
try (ServerSocket serverSocket = new ServerSocket(port)) {
    logger.info("服务启动中");
    Socket socket;
    while ((socket = serverSocket.accept()) != null) { //服务端accept()方法会阻塞等待直到有客户端连接
        logger.info("Accepted connection from {}", socket.getRemoteSocketAddress());
        threadPool.execute(new RequestHandlerThread(socket, requestHandler, serviceRegistry));
    }
} catch (Exception e) {
    logger.error("连接出错了");
}
```

#### **同步非阻塞（NIO）**

面向数据块

##### **buffer**

一个可以写入数据的内存块，使用缓冲区读写数据遵循以下四个步骤

1. 写数据
2. 调用buffer.flip()方法，从写模式切换到读模式
3. 读数据
4. 调用buffer.clear()或buffer.compat()方法

**buffer类的一些操作源码：**

1. 初始化

```java
// Invariants: mark <= position <= limit <= capacity
private int mark = -1; //调用mark()方法标记position位置，以便之后reset
private int position = 0; //下一个操作的位置
private int limit; //position能到的最大位置，默认是capacity
private int capacity;

//Allocates a new int buffer.
public static IntBuffer allocate(int capacity) {
    if (capacity < 0)
        throw createCapacityException(capacity);
    return new HeapIntBuffer(capacity, capacity, null); //返回一个堆缓冲区
}

//Wraps an int array into a buffer.
public static IntBuffer wrap(int[] array, int offset, int length)
{
    try {
        return new HeapIntBuffer(array, offset, length, null);
    } catch (IllegalArgumentException x) {
        throw new IndexOutOfBoundsException();
    }
}
```

2. put

```java
public IntBuffer put(int x) {

    hb[ix(nextPutIndex())] = x; //hb数组position位置赋值为x
    return this;
}

final int nextPutIndex() {                          // package-private
    int p = position;
    if (p >= limit)
        throw new BufferOverflowException();
    position = p + 1; //position加一
    return p;
}
```

3. flip

```java
//读之前一定要flip切换到读模式，也就是把position归0（使用wrap创建的buffer不用，因为position为0）
public Buffer flip() {
    limit = position; //limit设为最后一个数据位置的下一个位置
    position = 0; //position归0开始读
    mark = -1;
    return this;
}
```

4.  clear方法清空缓冲区；compact方法只会清空已读取的数据，而还未读取的数据继续保存在Buffer中；

##### **channel**

- channel可以同时读写，流只能单独读或者写
- channel可以实现异步读写数据
- channel可以从buffer读取数据，也可以写数据到buffer

```java
//RandomAccessFile操作文件，第二个参数mode：
// r：只读；rw：读写；rws/rwd：写操作同步刷新到磁盘

try (RandomAccessFile raf  = new RandomAccessFile(new File("test.txt"), "rw");
    FileChannel channel = raf.getChannel()) {

    channel.write(ByteBuffer.wrap("伞兵一号卢本伟准备就绪！".getBytes())); //读
    System.out.println("After write: position : " + channel.position());
    channel.position(0);
    
    ByteBuffer buffer = ByteBuffer.allocate(1024);
    int read = channel.read(buffer);
    System.out.println(new String(buffer.array(), 0, read));
} catch (IOException e) {
    throw new RuntimeException(e);
```

channel还有个文件锁的功能，尝试获取与 `FileChannel` 关联的文件区域的独占或共享锁，shared变量声明是独占还是共享。

```java
//阻塞式，如果无法立即获取锁（因为其他线程或进程已经持有了锁），那么调用线程会被阻塞
public abstract FileLock lock(long position, long size, boolean shared)
//非阻塞式，尝试立即获取锁，如果锁不可用则不会阻塞，而是返回 null。
public abstract FileLock tryLock(long position, long size, boolean shared)
```


##### **selector**

一个组件，可以检测多个NIO channel，看看读或者写事件是否就绪。

多个Channel以事件的方式可以注册到同一个Selector，从而达到用一个线程处理多个请求成为可能。

```java
//服务端
//ServerSocketChannel 用于服务端，负责监听和接受连接请求。
//SocketChannel 用于客户端或服务端，负责连接和进行数据传输。
try (ServerSocketChannel serverSocketChannel = ServerSocketChannel.open();
     Selector selector = Selector.open()) {
    serverSocketChannel.bind(new InetSocketAddress(9999));
    //要使用选择器，必须使用非阻塞方式，这样才不会像阻塞IO一样卡在accept()方法
    serverSocketChannel.configureBlocking(false);
    serverSocketChannel.register(selector, SelectionKey.OP_ACCEPT);
    while (true) {
        int count = selector.select();
        System.out.println("监听到"+ count +"个事件");
        Set<SelectionKey> selectionKeys = selector.selectedKeys();
        Iterator<SelectionKey> iterator = selectionKeys.iterator();
        while (iterator.hasNext()) {
            SelectionKey key = iterator.next();
            if (key.isAcceptable()) { //如果当前key对应的通道已经做好准备accept
                SocketChannel socketChannel = serverSocketChannel.accept();
                System.out.println("客户端连接：" + socketChannel.getRemoteAddress());
                //将这个连接也注册到选择器
                socketChannel.configureBlocking(false);
                socketChannel.register(selector, SelectionKey.OP_READ);
            } else if (key.isReadable()) { //如果当前连接有可读的数据并且可以写，就开始处理
                SocketChannel socketChannel = (SocketChannel) key.channel();
                ByteBuffer byteBuffer = ByteBuffer.allocate(1024);
                int read = socketChannel.read(byteBuffer);
                if (read > 0) {
                    byteBuffer.flip();
                    System.out.println(new String(byteBuffer.array(), 0, read));
                }
                socketChannel.write(ByteBuffer.wrap("已收到".getBytes()));
            }
            iterator.remove();//调用 iterator.remove() 是为了从 selectedKeys 集合中移除已经处理过的 SelectionKey。如果不移除，下一次循环时这些 SelectionKey 还会被再次处理，可能会导致重复处理同一个事件。
        }
    }
} catch (IOException e) {
    throw new RuntimeException(e);
}

//客户端
try (SocketChannel socketChannel =
     SocketChannel.open(new InetSocketAddress("127.0.0.1", 9999));
     Scanner scanner = new Scanner(System.in)) {
    System.out.println("已连接服务器！");
    while (true) {
        System.out.println("请输入发送的内容：");
        String line = scanner.nextLine();
        socketChannel.write(ByteBuffer.wrap(line.getBytes()));
        ByteBuffer buffer = ByteBuffer.allocate(1024);
        socketChannel.read(buffer);
        buffer.flip();
        System.out.println("收到服务器返回的："+ new String(buffer.array(), 0, buffer.limit()));
    }
} catch (IOException e) {
    throw new RuntimeException(e);
}
```



##### reactor模式

```java
//Reactor，统筹全局
public class Reactor implements Runnable, Closeable {

    private final ServerSocketChannel serverSocketChannel;

    private final Selector selector;

    public Reactor() throws IOException {
        this.serverSocketChannel = ServerSocketChannel.open();
        this.selector = Selector.open();
    }

    @Override
    public void run() {
        try {
            serverSocketChannel.bind(new InetSocketAddress(9999));
            //要使用选择器，必须使用非阻塞方式，这样才不会像阻塞IO一样卡在accept()方法
            serverSocketChannel.configureBlocking(false);
            serverSocketChannel.register(selector, SelectionKey.OP_ACCEPT, new Acceptor(serverSocketChannel, selector));
            while (true) {
                int count = selector.select();
                System.out.println("监听到" + count + "个事件");
                Set<SelectionKey> selectionKeys = selector.selectedKeys();
                Iterator<SelectionKey> iterator = selectionKeys.iterator();
                while (iterator.hasNext()) {
                    this.dispatch(iterator.next());//SelectionKey实际上就是Acceptor或者Handler，这里转发过去调用run方法启动。
                    iterator.remove();
                }
            }
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    private void dispatch (SelectionKey key) {
        Object attachment = key.attachment();
        if (attachment instanceof Runnable) {
            ((Runnable) attachment).run();
        }
    }

    @Override
    public void close() throws IOException {
        serverSocketChannel.close();
        selector.close();
    }
}

//Acceptor 负责监听和接收连接请求
public class Acceptor implements Runnable {

    private final ServerSocketChannel serverSocketChannel;
    private final Selector selector;

    public Acceptor(ServerSocketChannel serverSocketChannel, Selector selector) {
        this.serverSocketChannel = serverSocketChannel;
        this.selector = selector;
    }

    @Override
    public void run() {
        try {
            SocketChannel socketChannel = serverSocketChannel.accept();
            System.out.println("客户端连接：" + socketChannel.getRemoteAddress());
            //将这个连接也注册到选择器
            socketChannel.configureBlocking(false);
            socketChannel.register(selector, SelectionKey.OP_READ, new Handler(socketChannel));
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }
}

//Handler 处理每个客户端连接的任务
public class Handler implements Runnable{

    private final SocketChannel socketChannel;
    private final ThreadPoolExecutor pool;

    public Handler(SocketChannel socketChannel) {
        this.socketChannel = socketChannel;
        pool = new ThreadPoolExecutor(5, 20,
                60, TimeUnit.SECONDS, new LinkedBlockingQueue<>(),
                new ThreadPoolExecutor.CallerRunsPolicy());
    }

    @Override
    public void run() {
        try {
            ByteBuffer byteBuffer = ByteBuffer.allocate(20);
            int read = socketChannel.read(byteBuffer);
            if (read < 0) {
                socketChannel.close();
                System.out.println("客户端断开连接！");
                return;
            }
            pool.execute(() -> {
                try {
                    if (byteBuffer.remaining() == 0) {
                        byteBuffer.flip();
                        System.out.println("线程 "+ Thread.currentThread().getName() + " " +
                                "处理客户端消息： " + new String(byteBuffer.array(), 0, byteBuffer.remaining()));
                        byteBuffer.clear();
                    }
                    socketChannel.write(ByteBuffer.wrap("已收到".getBytes()));
                } catch (IOException e) {
                    throw new RuntimeException(e);
                }
            });
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }
}
```

##### 主从reactor模式





#### NIO存在的问题

客户端关闭导致服务端空轮询

粘包拆包问题

- 消息定长
- 每个包末尾使用特殊分隔符
- 将消息分为头部和本体，头部保存数据包的长度


