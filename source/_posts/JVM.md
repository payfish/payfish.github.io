---
title: JVM
date: 2024-06-26 11:41:24
tags: JVM
category: Java
---

### JVM体系结构

![JVM体系结构](jvm体系结构.png)

实例

```java
class Dog {
    private String name;
    private static final int age = 23;

    public Dog(String name, int age) { //构造方法也是方法，存储在方法区
        this.name = name;
        this.age = age;
    }

    public void wolf() { //方法区
        System.out.println(name + " age " + age + " wolf");
    }
    
    public static void main(String[] args) {
        Dog dog = new Dog("fred", 23);
        dog.wolf();
    }
}
```

代码运行时，JVM各区域存储的信息

![JVM实例](jvm实例.png)

#### 方法区

**方法区**是Java虚拟机规范（JVM Specification）中定义的逻辑部分。**永久代**（Permanent Generation，PermGen）是HotSpot JVM在Java 8之前对方法区的具体实现。**元空间**（Metaspace）是Java 8及以后版本中对方法区的新的实现，取代了永久代。

被所有线程共享，存储静态变量，常量（final），运行时常量池（包括字符串常量和基本类型常量），类信息（类的名称、父类、接口、字段、方法等）

运行时常量池是方法区的一部分。Class 文件中除了有类的版本、字段、方法、接口等描述信息外，还有一项信息是常量池（Class文件常量池），用于存放编译器生成的各种字面量和符号引用（见下一段），这部分内容将在类加载后存放到方法区的运行时常量池中。运行时常量池相对于 Class 文件常量池的另一个重要特征是具备动态性，Java 语言并不要求常量一定只能在编译期产生，也就是并非预置入 Class 文件中的常量池的内容才能进入方法区的运行时常量池，运行期间也可能将新的常量放入池中，这种特性被开发人员利用比较多的是 String 类的 intern()方法。

> String.intern()是一个Native方法，它的作用是：如果字符常量池中已经包含一个等于此String对象的字符串，则返回常量池中字符串的引用，否则，将新的字符串放入常量池，并返回新字符串的引用

字面量比较接近于 Java 层面的常量概念，如文本字符串、被声明为 final 的常量值等。而符号引用总结起来则包括了下面三类常量：

- 类和接口的全限定名（即带有包名的 Class 名，如：org.lxh.test.TestClass）
- 字段的名称和描述符（private、static 等描述符）
- 方法的名称和描述符（private、static 等描述符）

虚拟机在加载 Class 文件时才会进行动态连接，也就是说，Class 文件中不会保存各个方法和字段的最终内存布局信息，因此，这些字段和方法的符号引用不经过转换是无法直接被虚拟机使用的。当虚拟机运行时，需要从常量池中获得对应的符号引用，再在类加载过程中的解析阶段将其替换为直接引用，并翻译到具体的内存地址中。（见下文动态链接）

#### 栈区和堆区

开始之前，先来个实战例子，[参考文章](https://jenkov.com/tutorials/java-concurrency/java-memory-model.html)

```java
public class MyRunnable implements Runnable { 

    public void run() { 
        methodOne(); 
    } 

    public void methodOne() { 
        int localVariable1 = 45; 

        MySharedObject localVariable2 = 
            MySharedObject.sharedInstance; 

        methodTwo(); 
    } 

    public void methodTwo() { 
        Integer localVariable1 = new Integer(99); 

    } 
}
```

```java
public class MySharedObject { 

    //指向 MySharedObject 实例的静态变量
    public static final MySharedObject sharedInstance = 
        new MySharedObject(); 

    //指向堆上的两个对象的成员变量
    public Integer object2 = new Integer(22); 
    public Integer object4 = new Integer(44); 

    public long member1 = 12345; 
    public long member2 = 67890; 
}
```

![](实战.png)

假设有两个线程thread1、thread2都在执行MyRunnable类的run()方法，就像下面这样：

```java
MyRunnable runnable = new MyRunnable();
Thread thread1 = new Thread(runnable);
Thread thread2 = new Thread(runnable);
thread1.start();
thread2.start();
```

两个线程都会执行methodOne()方法，首先会在自己的线程栈中创建基本数据类型（int）的局部变量localVariable1，其次会在各自自己的栈中保存对于MySharedObject()实例的引用localVariable2。题外话sharedInstance是静态字段，保存在方法区

MySharedObject对象实例保存在堆中，对应图中的Object3，两个线程栈中的localVariable2引用共同指向它。同时MySharedObject对象实例还有两个Integer类型的成员变量，成员变量本身与对象一起存储在堆上，这两个成员变量指向另外两个`Integer` 对象，对应堆中的Object2与Object4

两个线程执行到methodTwo()方法，会在自己的栈中存放localVariable1局部变量，并且每一个线程执行到这里都会在堆中创建一个新的Integer(99)对象，分别对应Object1与Object5

#### 栈

线程创建后，都会产生自己独立的程序计数器（PC）和栈（Stack），程序计数器存放下一条要执行的指令在方法内的偏移量，栈中存放一个个栈帧，每个栈帧对应着每个方法的每次调用，而栈帧又是有局部变量区和操作数栈两部分组成，局部变量区用于存放方法中的局部变量和参数，操作数栈中用于存放方法执行过程中产生的中间结果。栈的结构如下图所示：

![栈帧](栈.png)

局部变量表是一组变量值存储空间，用于存放方法参数和方法内部定义的局部变量。局部变量表所需的内存空间在编译期间完成分配，即在 Java 程序被编译成 Class 文件时，就确定了所需分配的最大局部变量表的容量。表内是一个一个的slot（槽）。虚拟机通过索引定位的方式使用局部变量表，索引值的范围是从 0 开始到局部变量表最大的 Slot 数量，对于 32 位数据类型的变量，索引 n 代表第 n 个 Slot，对于 64 位的，索引 n 代表第 n 和第 n+1 两个 Slot。如果是实例方法（非static），则局部变量表中的第 0 位索引的 Slot 默认是用于传递方法所属对象实例的引用，在方法中可以通过关键字“this”来访问这个隐含的参数。[JVM-栈帧之局部变量表](https://www.cnblogs.com/niulongwei/p/14864516.html)

操作数栈又常被称为操作栈，操作数栈的最大深度也是在编译的时候就确定了，32 位数据类型（int）所占的栈容量为 1，64 位数据类型（double）所占的栈容量为 2

每个栈帧都包含一个指向运行时常量池中该栈帧所属方法的引用，持有这个引用是为了支持方法调用过程中的动态连接。Class 文件的常量池中存在有大量的符号引用，字节码中的方法调用指令就以常量池中指向方法的符号引用为参数。这些符号引用，一部分会在类加载阶段或第一次使用的时候转化为直接引用（如 final、static 域等），称为静态解析，另一部分将在每一次的运行期间转化为直接引用，这部分称为动态连接。

栈的异常情况：

- 如果线程请求的栈深度大于虚拟机所允许的深度，将抛出StackOverflowError异常。
- 如果虚拟机在动态扩展栈时无法申请到足够的内存空间，则抛出OutOfMemoryError异常。

#### 堆

![堆内存示意图](堆内存.png)

> 使用VM options调整JVM启动参数

**堆内存大小配置**：

- `-Xms`：设置JVM堆内存的初始大小。
- `-Xmx`：设置JVM堆内存的最大大小。

根据 Java 虚拟机规范的规定，Java 堆可以处在物理上不连续的内存空间中，只要逻辑上是连续的即可。如果在堆中没有内存可分配时，并且堆也无法扩展时，将会抛出 OutOfMemoryError 异常。

**年轻代和老年代的比例**：

- `-XX:NewRatio`：这个参数用于设置老年代与年轻代的比例。默认值通常为2，即老年代大小是年轻代的两倍。比如，如果设置为`-XX:NewRatio=3`，则老年代大小是年轻代的三倍。
- `-XX:MaxNewSize`：设置年轻代的最大大小。
- `-XX:NewSize`：设置年轻代的初始大小。

**查看GC详细参数**：

- `-XX:+PrintGCDetails`

**使用jprofiler查看heap dump文件**：

- `-XX:+HeapDumpOnOutOfMemoryError`

```java
public class HeapTest {
    public static void main(String[] args) {
        long totalMemory = Runtime.getRuntime().totalMemory();
        long maxMemory = Runtime.getRuntime().maxMemory();
        System.out.println(totalMemory + "->" + totalMemory / 1024 / 1024 + "mb");
        System.out.println(maxMemory + "->" + maxMemory / 1024 / 1024 + "mb");

        List<HeapTest> list = new ArrayList<>();

        while (true) {
            list.add(new HeapTest());
        }
    }
}
```

![jProfiler可以看到ArrayList被撑爆了](heapDump.png)

#### 内存溢出

PC是唯一不会发生OOM的区域，本地方法栈只要不出现错误调用一般也不会OOM，因为本地方法一般都轮不到我们程序员来调用。下面给出各内存区域内存溢出的简单测试方法。

![](内存溢出.png)

这里有一点要重点说明，在多线程情况下，给每个线程的栈分配的内存越大，反而越容易产生内存溢出异常。操作系统为每个进程分配的内存是有限制的，虚拟机提供了参数来控制 Java 堆和方法区这两部分内存的最大值，忽略掉程序计数器消耗的内存（很小），以及进程本身消耗的内存，剩下的内存便给了虚拟机栈和本地方法栈，每个线程分配到的栈容量越大，可以建立的线程数量自然就越少。因此，如果是建立过多的线程导致的内存溢出，在不能减少线程数的情况下，就只能通过减少最大堆和每个线程的栈容量来换取更多的线程。

由于 Java 堆内也可能发生内存泄露（Memory Leak），这里简要说明一下内存泄露和内存溢出的区别：

内存泄露是指分配出去的内存没有被回收回来，由于失去了对该内存区域的控制，因而造成了资源的浪费。Java 中一般不会产生内存泄露，因为有垃圾回收器自动回收垃圾，但这也不绝对，当我们 new 了对象，并保存了其引用，但是后面一直没用它，而垃圾回收器又不会去回收它，这边会造成内存泄露，

内存溢出是指程序所需要的内存超出了系统所能分配的内存（包括动态扩展）的上限。

#### 对象实例化分析

```java
Object obj = new Object();
```

几乎所有人都知道obj 会作为引用类型（reference）的数据保存在 Java 栈的局部变量表中，而会在 Java 堆中保存该引用的实例化对象，但可能并不知道，Java 堆中还必须包含能查找到此对象类型数据的地址信息（如对象类型、父类、实现的接口、方法等），这些类型数据则保存在方法区中。

由于 reference 类型在 Java 虚拟机规范里面只规定了一个指向对象的引用，并没有定义这个引用应该通过哪种方式去定位，以及访问到 Java 堆中的对象的具体位置，因此不同虚拟机实现的对象访问方式会有所不同，主流的访问方式有两种：使用句柄池和直接使用指针。

通过句柄池访问的方式如下：

![](句柄池.png)

通过直接指针访问的方式如下：

![](直接指针.png)

这两种对象的访问方式各有优势，使用句柄访问方式的最大好处就是 reference 中存放的是稳定的句柄地址，在对象被移动（垃圾收集时移动对象是非常普遍的行为）时只会改变句柄中的实例数据指针，而 reference 本身不需要修改。使用直接指针访问方式的最大好处是速度快，它节省了一次指针定位的时间开销。目前 Java 默认使用的 HotSpot 虚拟机采用的便是是第二种方式进行对象访问的。[摘自《深入理解JVM虚拟机》]

### GC算法

#### 垃圾对象判定

**引用计数算法**：是给每个对象设置一个计数器，当有地方引用这个对象的时候，计数器+1，当引用失效的时候，计数器-1，当计数器为0的时候，对象不可能还在被使用了。缺点如下代码：它很难解决两个对象之间的相互循环引用问题，已被弃用

```java
public class Main {
    public static void main(String[] args) {
        Test a = new Test();
        Test b = new Test();

        a.another = b;
        b.another = a;

        //这里直接把a和b赋值为null，这样前面的两个对象我们不可能再得到了
        a = b = null;
    }

    private static class Test{
        Test another;
    }
}
```

**根搜索算法**：Java 和 C# 中都是采用根搜索算法来判定对象是否存活的。这种算法的基本思路是通过一系列名为“GC Roots”的对象作为起始点，从这些节点开始向下搜索，搜索所走过的路径称为引用链，当一个对象到 GC Roots 没有任何引用链相连时，就证明此对象是不可用的。 在 Java 语言里，每个对象的引用可作为 GC Roots 的条件包括下面几种：

- 栈（栈帧中的本地变量表）中引用的对象，其实就是我们方法中的局部变量，同样也包括本地方法栈中 JNI（Native 方法）的引用对象	
- 方法区中类的静态成员变量引用的对象
- 方法区中，常量池里面引用的对象，比如我们之前提到的`String`类型对象。
- 被添加了锁的对象（比如synchronized关键字）

如果某个对象无法到达任何GC Roots，则证明此对象是不可能再被使用的。

**最终判定**

经过根搜索算法判定后不再被引用的对象，不一定就一定被判了死刑必须回收，也有可能是死缓。

对象的finalize方法就是有可能挽救它生命的救命恩人，如果子类重写了此方法，那么子类对象在被判定为可回收时，会进行二次确认，也就是执行`finalize()`方法，而在此方法中，当前对象是完全有可能重新建立GC Roots的！所以，如果在二次确认后对象不满足可回收的条件，那么此对象不会被回收，巧妙地逃过了垃圾回收的命运。比如下面这个例子：

```java
public class Main {
    private static Test a;
    public static void main(String[] args) throws InterruptedException {
        a = new Test();
        //这里直接把a赋值为null，这样前面的对象我们不可能再得到了
        a  = null;
        //手动申请执行垃圾回收操作（注意只是申请，并不一定会执行，但是一般情况下都会执行）
        System.gc();
        //等垃圾回收一下()
        Thread.sleep(1000);
        //a最终没有被回收
        System.out.println(a);
    }

    private static class Test{
        @Override
        protected void finalize() throws Throwable {
            System.out.println(Thread.currentThread());
            System.out.println(this + " 开始了它的救赎之路！");
            a = this;
        }
    }
}
```

```shell
Thread[Finalizer,8,system]
Main$Test@1e2d67c9 开始了它的救赎之路！
Main$Test@1e2d67c9
```

注意`finalize()`方法是GC Root标记之后JVM自动创建一个名叫Finalizer的子线程去自动调用的，优先级较低，所以上面让主线程睡了一秒等待一下，同时，同一个对象的`finalize()`方法只会有一次调用机会，也就是说，如果我们连续两次这样操作，那么第二次，对象必定被回收。

当然，`finalize()`方法也并不是专门防止对象被回收的，我们可以使用它来释放一些程序使用中的资源等。

![摘自itbaima](finalize.png)

#### 标记-清除算法（Mark-Sweep）

​	为每个对象存储一个标记位，记录对象的状态（活着或是死亡）。分为两个阶段，一个是标记阶段，这个阶段内，为每个对象更新标记位，检查对象是否死亡；第二个阶段是清除阶段，该阶段对死亡的对象进行清除，执行 `GC` 操作。

优点：内存利用率高

缺点：每个活着的对象都要在标记阶段遍历一遍；所有对象都要在清除阶段扫描一遍，因此算法复杂度较高。没有移动对象，内存碎片多

#### 标记-复制算法（Copying）

标记要清除的对象，把存活的对象复制到另一块内存，然后一次性清除之前的那一块内存的所有对象，包括被标记为要清除的和活动的。最后交换两块区域即可。也就是Survivor区的from和to的交换策略。

> 新生代又可细分为**Eden空间**、**From Survivor空间**、**To Survivor空间**，默认比例为8:1:1。

优点：无内存碎片，内存效率高，时间复杂度低

缺点：需要一片额外空白内存空间，内存利用率低

#### 标记-整理算法（Mark-Compact）

标记阶段：与标记-清除算法类似，标记出所有活动对象。

整理阶段：将所有的活动对象移到一起，将要清除的对象移动到一起，然后清理掉这些对象。

优缺点：相比标记-清除算法，减少了内存碎片的产生，但是移动对象性能比复制和标记清除更低。

> GC：分代收集算法

即新生代的对象存活率低，使用复制算法，老年代存活率高，内存区域大，使用标记清除 + 标记压缩算法（先使用标记清除，内存碎片多到一定量就压缩清除一次）

#### 分代收集

Minor GC：Eden区空间已满时触发，对新生代进行GC

Major GC：主要针对老年代

Full GC：对整个堆内存和方法区进行垃圾回收，触发条件

- 每次晋升到老年代的对象平均大小大于老年代的剩余空间
- MinorGC后存活的对象超过了老年代剩余空间
- jdk8之前的永久代空间不足
- 手动调用System.gc()方法

**空间分配担保机制**

在一次MinorGC后，Eden区存活的对象仍然太多无法放进Survivor区，可以使用空间担保机制直接放入老年代中（前提是老年代要放得下才行），要是老年代也装不下这么多对象，JVM会判断一下之前每次GC进入老年代的平均大小是否小于当前老年代剩余空间，如果是的话，那么这次GC老年代也许也可以放得下。否则直接Full GC。具体见下图：

![GC流程](gc.png)

### 垃圾收集器

#### Serial

早期（1.4）的单线程收集器，每次GC时会stw，简单高效，缺点也很明显，你打游戏时暂停几秒去做垃圾回收就问你顶不顶得住。不过对于面向客户端的JavaFX和Swing这种桌面级的应用在新生代就是用的Serial收集器。

新生代采用复制算法，老年代采用标记整理算法

#### ParNew

Serial的多线程版本，GC时也会暂停所有用户线程

#### Parallel Scavenge/Parallel Old

多线程版本，与ParNew不同的是，它会自动根据吞吐量来衡量GC的时机，根据机器的性能选择最优的GC方案

新生代使用PS（标记复制算法），老年代使用PO（标记整理算法）。GC时也会暂停用户线程

jdk8默认使用这两个垃圾收集器。

#### CMS

jdk1.5，HotSpot推出了具有划时代意义的CMS收集器，Concurrent Mark-Sweap：并发标记清除回收器，GC时与用户线程并发执行，有四个阶段：

- 初始标记：需要暂停用户线程，但速度较快，标记出GC Root能直接关联到的对象
- 并发标记：从GC Roots的直接关联对象开始遍历整个对象图的过程，这个过程耗时较长但是不需要停顿用户线程，可以与垃圾收集线程一起并发运行。
- 重新标记：需要暂停用户线程，由于并发标记阶段可能某些用户线程会导致标记产生变化，因此这里需要再次暂停所有线程进行并行标记
- 并发清除：最后就可以直接将所有标记好的无用对象进行删除，因为这些对象程序中也用不到了，所以可以与用户线程并发运行。

由于标记清除算法会产生大量的内存碎片，导致可用连续空间逐渐变少，长期这样下来，会有更高的概率触发Full GC，并且在与用户线程并发执行的情况下，也会占用一部分的系统资源，导致用户线程的运行速度一定程度上减慢。

不过，如果你希望的是最低的GC停顿时间，这款垃圾收集器无疑是最佳选择，不过自从G1收集器问世之后，CMS收集器不再推荐使用了。

#### G1

jdk7提出，jdk9正式取代了JDK8默认的 Parallel Scavenge + Parallel Old 的回收方案。它是一款主要面向于服务端的垃圾收集器

之前我们的垃圾回收分为`Minor GC`、`Major GC `和`Full GC`，它们分别对应的是新生代，老年代和整个堆内存的垃圾回收，而G1收集器巧妙地绕过了这些约定，它将整个Java堆划分成`2048`个大小相同的独立`Region`块，每个`Region块`的大小根据堆空间的实际大小而定，整体被控制在1MB到32MB之间，且都为2的N次幂。所有的`Region`大小相同，且在JVM的整个生命周期内不会发生改变。

而每一个`Region`都可以根据需要，自由决定扮演哪个角色（Eden、Survivor和老年代），收集器会根据对应的角色采用不同的回收策略。此外，G1收集器还存在一个Humongous区域，它专门用于存放大对象（一般认为大小超过了Region容量一半的对象为大对象）这样，新生代、老年代在物理上，不再是一个连续的内存区域，而是到处分布的。

![](G1.png)

它的回收流程与CMS类似：

- 初始标记：需要暂停用户线程，但速度较快，标记出GC Root能直接关联到的对象
- 并发标记：从GC Roots的直接关联对象开始遍历整个对象图的过程，这个过程耗时较长但是不需要停顿用户线程，可以与垃圾收集线程一起并发运行。
- 重新标记：需要暂停用户线程，用于处理并发标记阶段漏标的那部分对象。
- 筛选回收：负责更新Region的统计数据，对各个Region的回收价值和成本进行排序，根据用户所期望的停顿时间来制定回收计划，可以自由选择任意多个Region构成回收集，然后把决定回收的那一部分Region的存活对象复制到空的Region中，再清理掉整个旧Region的全部空间。这里的操作涉及存活对象的移动，是必须暂停用户线程，由多个收集器线程并行完成的。

#### ZGC

ZGC自jdk11作为一个实验性回收器提出，到jdk15正式出版，**GC最大停顿时间小于1ms，支持16TB内存**。只需设置**–Xmx -XX:+UseZGC**即可一步到位。

相比于G1的region，ZGC将region分为了三种类型**（2MB、32MB、N\*2MB）**，也就是说分页的大小不固定了，内存中可以有2MB的区域也可以有32MB的，而G1的region是统一大小的。ZGC的分页模型可以动态地调整页的大小，以适应不同大小的对象，这样显然提高了内存利用率

它的执行流程和G1类似：也是初始标记->并发标记->重新标记并发标记时产生的新对象->迁移对象并清除

参考：[java - 你还在“垃圾”调优？快来看看JDK17的ZGC如何解放双手 | 京东云技术团队 - 京东云技术新知 - SegmentFault 思否](https://segmentfault.com/a/1190000044541814#item-5)

### 守护线程

**后台运行**：守护线程通常用于在后台执行辅助任务，例如垃圾收集、日志记录、监控等。

**生命周期依赖于非守护线程**：当所有非守护线程结束时，JVM会终止所有仍在运行的守护线程并退出。

**低优先级**：通常守护线程的优先级较低，因为它们的任务不如用户线程（非守护线程）重要。

```java
public static void main(String[] args) throws InterruptedException {
    Thread thread = new Thread(new Runnable() {
        @Override
        public void run() {
            while (true) {
                try {
                    System.out.println("我是守护线程" + Thread.currentThread().getName());
                    TimeUnit.SECONDS.sleep(1);
                } catch (InterruptedException e) {
                    throw new RuntimeException(e);
                }
            }
        }
    }, "DaemonThread");

    thread.setDaemon(true);
    thread.start();

    Thread.sleep(3000L);
    System.out.println("我是主线程，我即将退出");
}

```

输出：

```shell
我是守护线程DaemonThread
我是守护线程DaemonThread
我是守护线程DaemonThread
我是主线程，我即将退出
```

守护线程适用于以下场景：

1. **垃圾收集器**：JVM自带的垃圾收集线程就是一个守护线程，用于在后台清理不再使用的对象。
2. **日志记录**：在后台记录应用程序的运行日志。
3. **监控**：用于监控应用程序的状态，例如资源使用情况、性能指标等。

### 类加载器/双亲委派机制

- Bootstrap ClassLoader ：jre/lib
- ExtClassLoader ： jre/lib/ext下的jar
- AppClassLoader ： 加载用户路径ClassPath下的包
- 自定义类加载器 ： 加载用户自定义路径下的包

双亲委派模型的工作流程是：如果一个类加载器收到了类加载的请求，它首先不会自己去尝试加载这个类，而是把请求委托给父加载器去完成，依次向上，因此，所有的类加载请求最终都应该被传递到顶层的启动类加载器中，只有当父加载器在它的搜索范围中没有找到所需的类时，即无法完成该加载，子加载器才会尝试自己去加载该类。

使用双亲委派模型来组织类加载器之间的关系，有一个很明显的好处，就是 Java 类随着它的类加载器（说白了，就是它所在的目录）一起具备了一种带有优先级的层次关系，这对于保证 Java 程序的稳定运作很重要。例如，类java.lang.Object 类存放在`JDK\jre\lib`下的 rt.jar 之中，因此无论是哪个类加载器要加载此类，最终都会委派给启动类加载器进行加载，这边保证了 Object 类在程序中的各种类加载器中都是同一个类。

> 双亲委派机制：先自底向上检查是否已经加载，若未加载则从Bootstrap开始往下查看自己是否可以加载，若失败则抛出ClassNotFoundException

```java
public Class<?> loadClass(String name) throws ClassNotFoundException {
    return loadClass(name, false);
}
//              -----??-----
protected Class<?> loadClass(String name, boolean resolve)
    throws ClassNotFoundException
{
        // 首先，检查是否已经被类加载器加载过
        Class<?> c = findLoadedClass(name);
        if (c == null) {
            try {
                // 存在父加载器，递归的交由父加载器
                if (parent != null) {
                    c = parent.loadClass(name, false);
                } else {
                    // 直到最上面的Bootstrap类加载器
                    c = findBootstrapClassOrNull(name);
                }
            } catch (ClassNotFoundException e) {
                // ClassNotFoundException thrown if class not found
                // from the non-null parent class loader
            }

            if (c == null) {
                // If still not found, then invoke findClass in order
                // to find the class.即首先Bootstrap findClass -> ExtClassLoader -> AppClassLoader
                c = findClass(name);
            }
        }
        return c;
}
```

使用`jar tf rt.jar`查看jdk8/jre/lib下的rt.jar包（bootstrap加载器加载的类库）

```java
java/lang/Exception.class
java/lang/ThreadDeath.class
java/lang/Error.class
java/lang/Throwable.class
java/lang/System.class
java/lang/ClassLoader.class
java/lang/Cloneable.class
java/lang/reflect/Type.class
java/lang/reflect/AnnotatedElement.class
java/lang/reflect/GenericDeclaration.class
java/lang/Class.class
java/lang/CharSequence.class
java/lang/Comparable.class
java/io/Serializable.class
java/lang/String.class
java/lang/Object.class
```

### Native方法

native方法是用C和C++编写的底层方法，Java调用native方法的线程会进入该线程的本地方法栈，调用本地方法接口JNI

扩展Java的使用，融合不同的语言为Java使用

在内存中专门开辟的一片区域，本地方法栈，登记native方法

在JVM中，每个线程都有自己的本地方法栈，用于存储该线程的本地方法调用。当Java线程调用一个本地方法时：

1. JVM创建一个新的本地方法栈帧并将其推入该线程的本地方法栈。
2. 该线程在本地方法栈帧中执行本地代码。
3. 执行完成后，JVM将结果返回给Java代码，栈帧被移出本地方法栈。

这种设计确保了每个线程都有自己的本地方法调用栈帧，不会与其他线程的本地方法调用混淆，从而保证了线程安全性。

```java
private native void start0(); //Thread类通过本地方法start0启动线程
```



