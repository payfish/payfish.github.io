---
title: ThreadLocal内存泄漏
date: 2024-08-15 21:42:48
tags: ThreadLocal
categoty: 并发编程

---

### 原理

一个简单的例子

```java
public class UserHolder {
    private static final ThreadLocal<UserDTO> tl = new ThreadLocal<>();

    public static void saveUser(UserDTO user){
        tl.set(user);
    }

    public static UserDTO getUser(){
        return tl.get();
    }

    public static void removeUser(){
        tl.remove();
    }
}
```

ThreadLocal实例只有一个，每个线程都会拿到一个自己的ThreadLocalMap，用这个map来存储UserDTO变量，key是ThreadLocal实例，值是变量。

```java
//set源码
public void set(T value) {
    Thread t = Thread.currentThread();
    ThreadLocalMap map = getMap(t);
    if (map != null) {
        map.set(this, value);
    } else {
        createMap(t, value);
    }
}

```

```java
public T get() {
    Thread t = Thread.currentThread();
    ThreadLocalMap map = getMap(t);
    if (map != null) {
        ThreadLocalMap.Entry e = map.getEntry(this);
        if (e != null) {
            @SuppressWarnings("unchecked")
            T result = (T)e.value;
            return result;
        }
    }
    return setInitialValue();
}
```

```java
ThreadLocalMap getMap(Thread t) {
    return t.threadLocals;
}

void createMap(Thread t, T firstValue) {
    t.threadLocals = new ThreadLocalMap(this, firstValue);
}
```

### 强引用弱引用

> 强引用——>软引用——>弱引用——>虚引用

弱的不太虚，虚的最弱

#### 强引用

任何一个普通的对象引用都是强引用

```java
String s1 = "fusish"; //字符串常量池
String s2 = new String("fusish"); //“fuish”在堆区
String s3 = s2; //s2，s3这两个强引用在栈区
```

- `s1` 是一个字符串常量，指向字符串常量池中的 `"fusish"`。在 Java 中，字符串字面量会被保存在字符串常量池中，并且这些字符串对象在 JVM 的生命周期内通常不会被回收。因为它们被存储在常量池中，除非 JVM 关闭，否则它们的内存不会被释放。

- `s2` 是一个强引用，指向一个新创建的 `String` 对象，这个对象位于堆内存中。`s3` 是一个强引用，指向与 `s2` 相同的对象。

  只要 `s2` 和 `s3` 在它们的作用域范围内，且没有被显式设置为 `null` 或者没有超出作用域，它们所指向的对象将一直存在于堆内存中，不会被垃圾回收。

  一旦 `s2` 和 `s3` 超出它们的作用域（例如，方法执行完毕，局部变量被销毁），或者它们被显式地设为 `null`，且没有其他引用指向那个对象时，该对象就会变成垃圾，等待下一次垃圾回收。

#### 软引用

**软引用** 是一种比弱引用更强的引用类型。在 Java 中，软引用是用来实现内存敏感的缓存的。垃圾回收器在内存不足时才会回收被软引用引用的对象；如果内存充足，这些对象就会保留在内存中。

#### 弱引用

如果一个对象只剩一个**弱引用**在引用它，那么它会在下一次垃圾回收中被回收，不管内存充足与否。



#### 虚引用

**虚引用** 是一种最弱的引用类型。一个对象是否有虚引用的存在，完全不会对其生存时间构成影响，也无法通过虚引用来取得一个对象实例。虚引用主要用来在对象被回收之前进行一些清理工作。

> 调用 `phantomReference.get()` 始终返回 `null`，因为虚引用无法访问对象。



```java
// 使用强引用创建 String 对象
String strongRef1 = new String("1");
String strongRef2 = new String("2");
String strongRef3 = new String("3");

ReferenceQueue<String> referenceQueue = new ReferenceQueue<>();
// 创建软引用、弱引用、虚引用
SoftReference<String> softReference = new SoftReference<>(strongRef1);
WeakReference<String> weakRef = new WeakReference<>(strongRef2);
PhantomReference<String> phantomReference = new PhantomReference<>(strongRef3, referenceQueue);

// 打印强引用和弱引用
System.out.println("Before GC:");
System.out.println("Soft Reference: " + softReference.get());
System.out.println("Weak Reference: " + weakRef.get());
System.out.println("Phantom Reference: " + phantomReference.get());

// 将强引用设为 null
strongRef1 = null;
strongRef2 = null;
strongRef3 = null;
// 触发垃圾回收
System.gc();

// 再次检查弱引用
System.out.println("\nAfter GC:");
System.out.println("Soft Reference: " + softReference.get());
System.out.println("Weak Reference: " + weakRef.get());
System.out.println("Phantom Reference: " + phantomReference.get());
if (referenceQueue.poll() != null) {
System.out.println("The phantom-referenced object has been enqueued for finalization.");
} else {
System.out.println("The phantom-referenced object has NOT been enqueued yet.");
}
```

```java
Before GC:
Soft Reference: 1
Weak Reference: 2
Phantom Reference: null

After GC:
Soft Reference: 1
Weak Reference: null
Phantom Reference: null
The phantom-referenced object has been enqueued for finalization.
```



### 内存泄漏

什么是内存泄漏？ 

某个对象申请的内存无法被释放。[彻底搞清楚ThreadLocal与弱引用](https://zhuanlan.zhihu.com/p/139214244)写的很好，但是不完善，借用他的一张图：

![JVM内存区域](内存泄漏.jpg)

ThreadlocalMap对象的key是threadLocal对象的弱引用，value是存储的对象的强引用，如果主线程和thread的线程栈中threadLocal的引用被手动释放（反正就是某种原因导致threadLocal的强引用指向null了，不再指向堆中的ThreadLocal对象）。那么下一次垃圾回收时就会回收掉ThreadLocal对象（因为只有唯一一个弱引用指向它），此时ThreadLocalMap中的value由于是强引用无法被GC回收，也无法被访问。ThreadLocalMap 变量的生命周期是和当前线程的生命周期一样长的，只有在当前线程运行结束之后才会清除掉 value，因此会导致这个 value 一直停留在内存中，导致内存泄漏。

虽然 JDK 的开发者想到了这个问题，在使用 set get remove 的时候，会对 key 为 null 的 value 进行清理。但是我们还是要注意使用完ThreadLocal后手动调用remove函数清除不用的value。



