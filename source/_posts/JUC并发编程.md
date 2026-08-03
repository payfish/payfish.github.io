---

title: JUC并发编程

date: 2024-06-20 16:26:06

tags: JUC

category: 并发编程

---

# JUC并发编程



### 进程

一个程序，wechat.exe。每个进程都有自己独立的一块内存空间

### 线程
进程中的一个执行任务，同类的多个线程共享进程的堆区和方法区，每个线程有独立的PC，虚拟机栈和本地方法栈

java是不能开启线程的，Thread的start()方法通过调用本地方法``private native void start0();``来启动线程。

```java
thread.join();//主线程等待thread这个线程执行完毕才能继续执行
```

#### 线程的状态

```java
NEW, //新创建了一个线程对象，但还没有调用start()方法。

RUNNABLE,//Java线程中将就绪（ready）和运行中（running）两种状态笼统的称为“运行”。

BLOCKED,//表示线程阻塞于锁。

WAITING,//进入该状态的线程需要等待其他线程做出一些特定动作（通知或中断）。

TIMED_WAITING,//该状态不同于WAITING，它可以在指定的时间后自行返回。

TERMINATED;//表示该线程已经执行完毕。
```

#### 线程优先级

```java
public static final int MIN_PRIORITY = 1;
/**
 * The default priority that is assigned to a thread.
 */
public static final int NORM_PRIORITY = 5;
/**
 * The maximum priority that a thread can have.
 */
public static final int MAX_PRIORITY = 10;

public final void setPriority(int newPriority) { // source code
    ThreadGroup g;
    checkAccess();
    if (newPriority > MAX_PRIORITY || newPriority < MIN_PRIORITY) {
        throw new IllegalArgumentException();
    }
    if((g = getThreadGroup()) != null) {
        if (newPriority > g.getMaxPriority()) {
            newPriority = g.getMaxPriority();
        }
        setPriority0(priority = newPriority);
    }
}
```



### 并发
CPU一核，快速交替执行多个线程 操作同一个资源

### 并行
CPU多核同时执行多个线程



### synchronized和Lock的区别

1、synchronized是Java内置关键字，Lock是类

2、synchronized无法判断获取锁的状态，Lock可以

3、synchronized会自动释放锁，Lock必须手动释放，否则会**死锁**

4、synchronized未获取到锁的线程会一直等待，Lock锁不一定会一直等待下去

5、synchronized可重入锁，不可以中断，非公平；Lock可重入锁，不可以中断，可设置公平与否

6、synchronized适合锁少量代码块，Lock适合锁大量同步代码

7、synchronized只能锁类对象和普通对象，Lock可以锁任意的共享资源

> 可重入锁：synchronized， ReentrantLock，同一线程可以多次获取同一把锁

- 方法A需要调用方法B，方法A需要先获取锁，执行到调用B时方法B同样需要获取同一把锁，可重入锁保证了线程可以在方法B中继续获取这同一把锁。不可重入锁则会导致线程在方法B中阻塞等待。

### 生产者消费者问题

#### synchronized锁版本

```java
class Pc {
    private int food;

    public synchronized void producer() throws InterruptedException {
        while (food != 0) { //为了防止虚假唤醒，需要将wait函数放在while循环中，而不能用if
            this.wait();
        }
        food ++;
        System.out.println(Thread.currentThread().getName() + "-->" + food);
        this.notifyAll();
    }

    public synchronized void consumer() throws InterruptedException {
        while (food == 0) {
            this.wait();
        }
        food --;
        System.out.println(Thread.currentThread().getName() + "-->" + food);
        this.notifyAll();
    }
}
```

#### Lock锁版本

```java
class Pc {
    private int food;
    Lock lock = new ReentrantLock();
    Condition condition = lock.newCondition();

    public void producer() throws InterruptedException {
        lock.lock();
        try {
            while (food != 0) {
                condition.await();
            }
            food ++;
            System.out.println(Thread.currentThread().getName() + "-->" + food);
            condition.signalAll();
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        } finally {
            lock.unlock();
        }
    }

    public void consumer() throws InterruptedException {
        lock.lock();
        try {
            while (food == 0) {
                condition.await();
            }
            food --;
            System.out.println(Thread.currentThread().getName() + "-->" + food);
            condition.signalAll();
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        } finally {
            lock.unlock();
        }
    }
}
```



### CopyOnWrite

 #### CopyOnWriteArrayList 

是线程安全的

```java
//源码，add方法
public boolean add(E e) {
        synchronized (lock) {
            Object[] es = getArray(); //拿到原始array
            int len = es.length;
            es = Arrays.copyOf(es, len + 1);
            es[len] = e;
            setArray(es); 
            return true;
        }
    }

/** The array, accessed only via getArray/setArray. */
private transient volatile Object[] array;
```

通过自定义一个lock对象，更加精细地控制同步，CopyOnWriteArrayList中的所有同步方法（mutators）都需要先获取这把锁才能执行操作，如上

```java
	/**
		* The lock protecting all mutators.  (We have a mild preference
		* for builtin monitors over ReentrantLock when either will do.)
	*/
	final transient Object lock = new Object();

```

#### CopyOnWriteArraySet

和上面一样，底层是CopyOnWriteArrayList，使用CopyOnWriteArrayList的addIfAbsent方法来添加新元素并去重

```java
    /**
     * Appends the element, if not present.
     *
     * @param e element to be added to this list, if absent
     * @return {@code true} if the element was added
     */
    public boolean addIfAbsent(E e) {
        Object[] snapshot = getArray();
        return indexOfRange(e, snapshot, 0, snapshot.length) < 0 //indexOfRange查找当前数组范围内要新增的元素e是否存在，不存在返回-1，可以add
            && addIfAbsent(e, snapshot);
    }
```



>  题外话：HashSet底层是什么？

```java
    /**
     * Constructs a new, empty set; the backing {@code HashMap} instance has
     * default initial capacity (16) and load factor (0.75).
     */
    public HashSet() {
        map = new HashMap<>();
    }

	public boolean add(E e) {
        return map.put(e, PRESENT) == null;
    }

    // Dummy value to associate with an Object in the backing Map
    private static final Object PRESENT = new Object();
```



### ConcurrentHashMap

`ConcurrentHashMap` 通过分段锁（Segment）和 CAS 操作保证了并发访问的安全性。每个 Segment 类似于一个小的 `HashMap`，它们分别维护桶数组的一部分，减少了锁的粒度，提高了并发访问性能。

CAS操作的一个弊端就是成功率太低了，通过分段锁的思想可以提高每一段的成功率，从而提高整体的成功率。



### 计数器

#### CountDownLatch

```java
//  CountDownLatch 减法计数器
    public static void main(String[] args) {
        CountDownLatch countDownLatch = new CountDownLatch(6);
        for (int i = 0; i < 6; ++i) {
            new Thread(() -> {
                System.out.println("线程" + Thread.currentThread().getName() + " 离开");
                countDownLatch.countDown();  // 每个工作线程执行完成后调用countDown()方法，减少计数器
            }, String.valueOf(i)).start();
        }
        try {
            countDownLatch.await();// 主线程等待所有工作线程完成
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        }
        System.out.println("关门");
    }
```

#### CyclicBarrier

```java
// CyclicBarrier 加法计数器
// 构造方法：public CyclicBarrier(int parties, Runnable barrierAction)
	CyclicBarrier cyclicBarrier = new CyclicBarrier(7, new Thread(() -> System.out.println("开启大门"))); 
	// 7: 指定需要同步等待的线程数量，即到达屏障点的线程数量
    for (int i = 1; i <= 7; ++i) {
        int finalI = i;
        new Thread(() -> {
            System.out.println("线程" + finalI + " 阻塞");
            try {
                cyclicBarrier.await(); // 当线程调用 await() 方法时，它会被阻塞，直到所有线程都调用了await() 方法，然后屏障会开放，启动自定义的线程执行相应操作
            } catch (InterruptedException | BrokenBarrierException e) {
                throw new RuntimeException(e);
            }
        }).start();
```

#### Semaphore

```java
// Semaphore 信号量限流
	Semaphore semaphore = new Semaphore(3);
        for (int i = 1; i <= 6; ++i) {
            int finalI = i;
            new Thread(() -> {
                try {
                    semaphore.acquire();
                    System.out.println("线程" + finalI + " 抢到车位！");
                    Thread.sleep(2000);
                    System.out.println("线程" + finalI + " 离开！");
                } catch (InterruptedException e) {
                    throw new RuntimeException(e);
                } finally {
                    semaphore.release();
                }
            }).start();
```



### 阻塞队列

相比于传统队列，阻塞队列引入了两组新的添加删除操作方法

```java
	// 队满则阻塞等待，一直等待直到空出位置
	public void put(E e) throws InterruptedException {
        Objects.requireNonNull(e);
        final ReentrantLock lock = this.lock;
        lock.lockInterruptibly();
        try {
            while (count == items.length)
                notFull.await();
            enqueue(e);
        } finally {
            lock.unlock();
        }
    }
	
	// 队空阻塞等待，一直等待
	public E take() throws InterruptedException {
        final ReentrantLock lock = this.lock;
        lock.lockInterruptibly();
        try {
            while (count == 0)
                notEmpty.await();
            return dequeue();
        } finally {
            lock.unlock();
        }
    }
	
	// 重载了offer方法，阻塞等待指定时间，超时则自动结束程序
	boolean offer(E e, long timeout, TimeUnit unit) throws InterruptedException;

	// 重载了poll方法
	E poll(long timeout, TimeUnit unit) throws InterruptedException;
```

> 同步队列 `SynchronousQueue`

```java
BlockingQueue<String> synchronousQueue = new SynchronousQueue<>();
//1.生产者-消费者模式
//2.线程池任务提交
//3.运行时任务交换
//4.负载均衡
```



### Callable

相比于Runnable，多了一个返回值

```java
public static void main(String[] args) throws ExecutionException, InterruptedException {
    MyThread thread = new MyThread();
    FutureTask<String> futureTask = new FutureTask<>(thread);
    new Thread(futureTask, "A").start();
    new Thread(futureTask, "B").start();
    System.out.println(futureTask.get());

}

static class MyThread implements Callable<String> {
    @Override
    public String call() throws Exception {
        System.out.println(Thread.currentThread().getName() + " running。。。");
        Thread.sleep(2000);
        return "call() called";
    }
}
```





### 线程池

![阿里开发手册-线程池的创建](线程池.png)

```java
ThreadPoolExecutor threadPoolExecutor = new ThreadPoolExecutor(
        2, // corePoolSize
        5, // maximumPoolSize
        5L, // keepAliveTime
        TimeUnit.SECONDS, // java.util.concurrent.TimeUnit unit
        new LinkedBlockingQueue<Runnable>(3), // 阻塞队列
        new ThreadPoolExecutor.AbortPolicy() // 拒绝策略
);

// 拒绝策略：线程数超过maximumPoolSize + BlockingQueue的size时
AbortPolicy(): 抛出异常`java.util.concurrent.RejectedExecutionException`
CallerRunsPolicy(): 交给调用execute方法的线程执行
DiscardPolicy(): 默默丢弃被拒绝的任务
DiscardOldestPolicy(): 丢弃最旧的未处理任务，然后尝试执行被拒绝的这个任务
    
// maximumPoolSize设置原则
// CPU密集型：maximumPoolSize = Runtime.getRuntime.availableProcessors() + 1; 加一是为了确保某些线程在等待时，仍有线程可以执行任务
// IO密集型：大一点，大于那些十分耗IO的线程数
    
  
//ThreadPoolExecutor的执行方法
void execute(Runnable command); 
Future<?> submit(Runnable task) //有返回值，future。通过Future的get()方法同步等待线程执行完成返回
<T> Future<T> submit(Runnable task, T result)
<T> Future<T> submit(Callable<T> task);
```

- corePoolSize: 线程池中保持存活的核心线程数，即使这些线程是空闲的也不会被回收。

- maximumPoolSize: 线程池中允许的最大线程数。当任务的数量超过 `corePoolSize` 并且阻塞队列已满时，如果线程数量没有达到 `maximumPoolSize`，线程池会创建新的线程来执行任务。
- keepAliveTime: 当线程池中的线程数量超过 `corePoolSize` 时，多余的空闲线程在超过 `keepAliveTime` 时间后将被终止回收。这一参数仅在线程数大于 `corePoolSize` 时才会生效。
- workQueue: 阻塞队列

- handler: 任务数量超过 `maximumPoolSize` + 队列容量时的拒绝策略

### 四大函数式接口

```java
@FunctionalInterface //函数式接口是一个只包含一个抽象方法（abstract method）的接口
// 抽象方法是一个没有实现的方法，只包含方法签名（即方法的声明），但不包含方法体。抽象方法必须在实现类中被重写。
public interface Function<T, R> {
    /**
     * Applies this function to the given argument.
     *
     * @param t the function argument
     * @return the function result
     */
    R apply(T t);
}

//函数型接口，输入T，输出R
Function<String, Integer> function = Integer::parseInt; 
function.apply("123");

//断言型接口，输入T，返回boolean
Predicate<Integer> predicate = x -> x % 2 == 0; 
predicate.test(4);

//消费型接口，输入T，无返回值
Consumer<String> consumer = System.out::println;
consumer.accept("123");

//供给型接口，无输入，有返回值
Supplier<String> supplier = () -> "123";
supplier.get(); //返回"123"
```



### Stream流

```java
User1 u1 = new User1(1,"a",21);
User1 u2 = new User1(2,"b",22);
User1 u3 = new User1(3,"c",23);
User1 u4 = new User1(4,"d",24);
User1 u5 = new User1(6,"e",25);
List<User1> list = Arrays.asList(u1, u2, u3, u4, u5);

list.stream() //Stream<User1>
        .filter(u -> u.getId() % 2 == 0)
        .filter(u -> u.getAge() > 23)
        .map(u -> u.getName().toUpperCase()) //Stream<String>
        .sorted(Comparator.reverseOrder())
        .limit(1)
        .forEach(System.out::println);
// 输出E
```



### ForkJoin

并行处理框架，用于执行可以被递归地拆分成更小任务的工作负载。旨在充分利用多核处理器的能力来提升并行计算的性能。

**任务分割 (Fork)**：将一个大任务分解成多个较小的子任务。

**任务合并 (Join)**：在子任务完成后，将它们的结果合并起来形成最终结果。



### CompletableFuture

```java

//supplyAsync 有返回值的异步回调

CompletableFuture<String> future = CompletableFuture.supplyAsync(() -> {
    System.out.println(Thread.currentThread().getName() + " supplyAsync");
    int i = 10 / 0; // 除0异常
    return "hello world";
});

System.out.println(future.whenComplete((t, u) -> { // 成功走whenComplete
    System.out.println("t是任务成功执行时的正常返回值--->" + t.toUpperCase()); // HELLO WORLD
    System.out.println("u是执行失败时的错误信息--->" + u); // 成功为null
}).exceptionally((e) -> { // 失败走exceptionally
    System.out.println(e.getMessage());
    return String.valueOf(404);
}).get());
```



### JMM和volatile

> JMM: Java内存模型，是一种约定，主要规定了线程自己的本地内存和主存之间的共享变量交互的规则

JMM同步约定：

1.线程解锁前，必须把共享变量立即写回主存

2.线程加锁前，必须读取主存共享变量的最新值到自己的工作内存

![JMM模型](jmm.png)

JMM定义的规则：

- 不允许一个线程无原因地（没有发生过任何 assign 操作）把数据从线程的工作内存同步回主内存中。

- 一个新的变量只能在主内存中 “诞生”，不允许在工作内存中直接使用一个未被初始化（load 或 assign）的变量，换句话说就是对一个变量实施 use 和 store 操作之前，必须先执行过了 assign 和 load 操作。

- 一个变量在同一个时刻只允许一条线程对其进行 lock 操作，但 lock 操作可以被同一条线程重复执行多次，多次执行 lock 后，只有执行相同次数的 unlock 操作，变量才会被解锁。

- 如果对一个变量执行 lock 操作，将会清空工作内存中此变量的值，在执行引擎使用这个变量前，需要重新执行 load 或 assign 操作初始化变量的值。

- 如果一个变量事先没有被 lock 操作锁定，则不允许对它执行 unlock 操作，也不允许去 unlock 一个被其他线程锁定住的变量。



> volatile: JVM提供的轻量级同步机制，关键字

1.保证可见性：这是因为 `volatile` 变量会直接存储在主存中，每次读取时都直接从主存读取，而不是从线程的工作内存（缓存）中读取。

2.不保证原子性

3.禁止指令重排，保证指令执行的顺序性：在编译器和处理器层面，使用 `volatile` 会插入内存屏障，防止对该变量的读/写操作与其他内存操作进行重排序，从而保证了某些顺序性。

```java
private static int num = 0;

public static void main(String[] args) throws InterruptedException {
    new Thread(() -> {
        while (num == 0) {

        }
    }, "A").start();

    TimeUnit.SECONDS.sleep(2);

    num += 1;
    System.out.println(num);
}
//程序打印1，但是一直执行并不结束，因为A线程中的num值一直为0，并未更新
//private static volatile int num = 0; 使用volatile保证num变量的可见性
//即一个线程对 num 的修改对其他线程是立即可见的
```



```java
private volatile static int num = 0; //volatile不能保证对num操作的原子性，最后num的结果始终小于10000

private static void add() {
    num ++;
}
//num ++ 并不是一个原子操作。在多线程环境下，这些步骤可能被不同的线程打断，从而导致竞争条件。例如，一个线程读取 num 的值为 5，在它增加值之前，另一个线程也读取了同样的值 5 并增加了它们的值。最终的结果是两个线程都将值 6 写回 num，而预期的结果应该是 7。

public static void main(String[] args) throws InterruptedException {
    for (int i = 0; i < 10; i++) {
        new Thread(() -> {
            for (int j = 0; j < 1000; j++) {
                add();
            }
        }).start();
    }
    while (Thread.activeCount() > 2) { //除了main和gc线程之外，还有上面没执行完的线程
        Thread.yield(); //就让主线程让出CPU
    }

    System.out.println(Thread.currentThread().getName() + " " + num);
}

// 修改，1.使用atomic包中的原子类保证原子性 2。使用synchronized关键字
private static AtomicInteger num = new AtomicInteger(0);
private static void add() {
    num.getAndIncrement();
}
```

### 单例模式

```java
private static volatile Lazy instance; //volatile禁止指令重排，保证instance创建成功，而不会出现（1）先分配内存空间，（2）instance指向该内存空间，（3）接着再初始化对象的情况发生，这种情况其他线程可能返回一个不为null但未被初始化的对象

private Lazy() {
    System.out.println(Thread.currentThread().getName() + " ok");
}

public static Lazy getInstance() { //双重检测锁定
    if (instance == null) {
        synchronized (Lazy.class) {
            if (instance == null) {      
                instance = new Lazy();//正常创建对象指令 (1)分配内存空间
            }						  //		   (2)执行构造方法初始化对象
        }							  //         (3)把instance对象指向该内存空间

    }
    return instance;
}

public static void main(String[] args) throws NoSuchMethodException, InvocationTargetException, InstantiationException, IllegalAccessException {

    for (int i = 0; i < 10; i++) {
        new Thread(Lazy::getInstance).start();
    }
}
```

>  防止序列化反序列化破坏单例模式，添加readResolve函数

```java
/**
 * readResolve方法的用途是在对象反序列化时返回一个已有的对象，而不是反序列化过程中创建的新对象。
 * @return
 */
public Object readResolve(){
    return getInstance();

```

> 使用枚举类实现单例模式

```java
//Cannot reflectively create enum objects 反射不能创建枚举对象，因此是安全的
//枚举类型在Java中天然地防止了通过序列化和反序列化破坏单例模式的风险，因此不需要加入readResolve函数来防止序列化破坏。
public enum singleEnum {

    INSTANCE;

    public singleEnum getInstance() {
        return INSTANCE;
    }
}
```

**应用场景**

- 数据库连接池、线程池
- Spring的bean：保证每个bean在Spring容器中只有一个实例，这有助于减少内存使用和管理bean的生命周期。

- Spring ApplicationContext: Spring应用程序上下文也是一个单例，负责管理Spring容器中的所有bean和配置。
- 

### 乐观锁

> 乐观锁就是操作共享变量时乐观地认为不会有其他线程对数据进行修改，不加锁，只有在提交时（更新时）判断其他线程在这之前有没有对变量进行修改，失败就回滚或者提示。可以通过版本号机制或者CAS算法实现

> 悲观锁总是悲观地假设最坏的情况，操作时加锁，一次只能一个线程访问，其他线程只能等待。MySQL的读写锁，synchronized关键字等

#### 版本号控制

- 取出记录时，获取当前`version`
- 更新时，带上这个`version`
- 执行更新时， `set version = newVersion where version = oldVersion`
- 如果`version`不对，就更新失败

#### CAS

>compare and swap的缩写

三个参数：

- 需要读写的内存位置`V`
- 进行比较的预期原值`A`
- 拟写入的新值`B`

缺点：

- ABA问题

  比如说一个线程`T1`从内存位置`V`中取出`A`，这时候另一个线程`T2`也从内存中取出`A`，并且`T2`进行了一些操作变成了`B`，然后`T2`又将`V`位置的数据变成`A`，这时候线程`T1`进行`CAS`操作发现内存中仍然是`A`，然后`T1`操作成功。尽管线程`T1`的`CAS`操作成功，但可能存在潜藏的问题。

- 自旋CAS

  ```java
  @IntrinsicCandidate
  public final int getAndAddInt(Object o, long offset, int delta) {
      int v;
      do { // 自旋锁
          v = getIntVolatile(o, offset); // 获取对象在偏移处的volatile最新值（volatile保证可见性，被其他线程更新的值）
      } while (!weakCompareAndSetInt(o, offset, v, v + delta)); // CAS操作，不解释了
      return v;
  }
  ```

- 只能保证一个共享变量的原子操作

AtomicInteger

AtomicReference<V>

### 死锁

#### 模拟

```java
public class DeadLockTest {
    public static void main(String[] args) {

        Dog dog1 = new Dog("bob");
        Dog dog2 = new Dog("tom");

        new Thread(new MyThread1(dog1, dog2), "t1").start();
        new Thread(new MyThread1(dog2, dog1), "t2").start();
    }
}
class Dog { //拿狗当锁
    private String name;

    public Dog(String name) {
        this.name = name;
    }

    @Override
    public String toString() {
        return name;
    }
}

class MyThread1 implements Runnable {
    Dog dogA;
    Dog dogB;

    MyThread1(Dog A, Dog B) {
        this.dogA = A;
        this.dogB = B;
    }

    @Override
    public void run() {
        synchronized (dogA) {
            System.out.println(Thread.currentThread().getName() + "锁定了" + dogA);
            try {
                TimeUnit.SECONDS.sleep(2);
            } catch (InterruptedException e) {
                throw new RuntimeException(e);
            }
            synchronized (dogB) {
                System.out.println(Thread.currentThread().getName() + "锁定了" + dogB);
            }
        }
    }
}
```

#### 排查

使用 **`jps -l`**查看进程的进程号

使用 **`jstack "进程号"`**定位死锁问题

```java
Java stack information for the threads listed above:
===================================================
"t1":
        at com.fu1sh.juc.MyThread1.run(DeadLockTest.java:47)
        - waiting to lock <0x000000071be545c8> (a com.fu1sh.juc.Dog)
        - locked <0x000000071be54588> (a com.fu1sh.juc.Dog)
        at java.lang.Thread.run(java.base@17.0.10/Thread.java:842)
"t2":
        at com.fu1sh.juc.MyThread1.run(DeadLockTest.java:47)
        - waiting to lock <0x000000071be54588> (a com.fu1sh.juc.Dog)
        - locked <0x000000071be545c8> (a com.fu1sh.juc.Dog)
        at java.lang.Thread.run(java.base@17.0.10/Thread.java:842)

Found 1 deadlock.
```

