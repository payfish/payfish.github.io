---

title: HashMap源码分析

date: 2024-06-22 16:59:39

tags: 源码分析

category: Java

---

## HashMap源码分析

虽然在学习CS61B的时候自己动手写了一个简易版的HashMap，但是跟实际的完全没有可比性，最近开始深入底层，遂记录。

### 初始参数

```java
static final int DEFAULT_INITIAL_CAPACITY = 1 << 4; // aka 16
static final int MAXIMUM_CAPACITY = 1 << 30;
static final float DEFAULT_LOAD_FACTOR = 0.75f;
static final int TREEIFY_THRESHOLD = 8;//转红黑树阈值，链表中元素大于此就将其转为红黑树
static final int UNTREEIFY_THRESHOLD = 6; //树转链表阈值，树中元素低于此就转为链表
static final int MIN_TREEIFY_CAPACITY = 64; //整个表中元素超过该值时才可以开启树形化操作 ？？？？还是数组长度？？？
```



### 初始方法

```java
// >>>表示无符号右移
// 对key的hashCode右移16位再异或，可以增加hash的复杂度，降低hash冲突的概率
static final int hash(Object key) {
	int h;
    return (key == null) ? 0 : (h = key.hashCode()) ^ (h >>> 16);
    //注意这里允许key为null！！！为null的hashcode就是0，相当于只能有一个key为null
}
```

### put

```java
public V put(K key, V value) {
	return putVal(hash(key), key, value, false, true);
}
/**
* onlyIfAbsent:默认为false，表示若key相同，用新值覆盖旧值
**/
final V putVal(int hash, K key, V value, boolean onlyIfAbsent,
                   boolean evict) {
        Node<K,V>[] tab; Node<K,V> p; int n, i;
    	//第一次插入元素，初始化，HashMap为了节约内存在使用时才初始化数组
        if ((tab = table) == null || (n = tab.length) == 0)
            n = (tab = resize()).length;
    	//路由地址算法，即hash % n，这里n为数组长度，始终是2的幂，故可以用位运算来优化
    	//数组该地址对应的节点为空，创建一个新节点即可
        if ((p = tab[i = (n - 1) & hash]) == null)
            tab[i] = newNode(hash, key, value, null);
        else {
            Node<K,V> e; K k;
            //当前节点就是目标节点
            if (p.hash == hash &&
                ((k = p.key) == key || (key != null && key.equals(k))))
                e = p;
            //没找到目标节点，且当前节点是红黑树节点
            else if (p instanceof TreeNode)
                e = ((TreeNode<K,V>)p).putTreeVal(this, tab, hash, key, value);
            //当前节点是普通链表节点
            else {
                for (int binCount = 0; ; ++binCount) {
                    //尾插法
                    if ((e = p.next) == null) {
                        p.next = newNode(hash, key, value, null);
                        if (binCount >= TREEIFY_THRESHOLD - 1) // -1 for 1st
                            treeifyBin(tab, hash);
                        break;
                    }
                    //找到目标节点，立即break;
                    if (e.hash == hash &&
                        ((k = e.key) == key || (key != null && key.equals(k))))
                        break;
                    p = e;
                }
            }	
            //存在key对应的mapping
            if (e != null) { // existing mapping for key
                V oldValue = e.value;
                // 覆盖旧值
                if (!onlyIfAbsent || oldValue == null)
                    e.value = value;
                afterNodeAccess(e);
                return oldValue;
            }
        }
        ++modCount;
        if (++size > threshold)
            resize();
        afterNodeInsertion(evict);
        return null;
    }
```



### resize

```java
/**
 * newCap: the new capacity, MUST be a power of two
 */
final Node<K,V>[] resize() {
    Node<K,V>[] oldTab = table;   // 获取旧表
    int oldCap = (oldTab == null) ? 0 : oldTab.length;  // 获取旧表的容量old capacity
    int oldThr = threshold;  // 获取旧的扩容阈值
    int newCap, newThr = 0;
    if (oldCap > 0) {  // 如果旧表的容量大于0
        if (oldCap >= MAXIMUM_CAPACITY) {  // 如果旧容量已经达到最大容量
            threshold = Integer.MAX_VALUE;  // 将阈值设置为最大值
            return oldTab;  // 返回旧表
        }
        newCap = oldCap << 1;  // 新容量是旧容量的两倍
        if (newCap < MAXIMUM_CAPACITY && oldCap >= DEFAULT_INITIAL_CAPACITY)
            newThr = oldThr << 1;  // 新的扩容阈值也是旧阈值的两倍
    }
    else if (oldThr > 0) // initial capacity was placed in threshold
        newCap = oldThr;  // 如果旧容量为0但旧阈值大于0，设置新容量为旧阈值
    else {               // oldThr == 0 && oldCap == 0 此为第一次初始化map时的操作
        newCap = DEFAULT_INITIAL_CAPACITY;  // 设置新容量为默认初始容量
        newThr = (int)(DEFAULT_LOAD_FACTOR * DEFAULT_INITIAL_CAPACITY);  // 设置新的扩容阈值 16 * 0.75 = 12
    }
    if (newThr == 0) {
        float ft = (float)newCap * loadFactor;
        newThr = (newCap < MAXIMUM_CAPACITY && ft < (float)MAXIMUM_CAPACITY ?
                  (int)ft : Integer.MAX_VALUE);
    }
    threshold = newThr;  // 更新阈值
    @SuppressWarnings({"rawtypes","unchecked"})
    Node<K,V>[] newTab = (Node<K,V>[])new Node[newCap];  // 创建新表
    table = newTab;
    if (oldTab != null) {  // 如果旧表不为空
        for (int j = 0; j < oldCap; ++j) {  // 遍历旧表中的每个桶
            Node<K,V> e;
            if ((e = oldTab[j]) != null) {  // 如果当前桶不为空
                oldTab[j] = null;  // 释放旧表中的引用，帮助垃圾回收
                if (e.next == null)  // 如果当前桶中只有一个节点
                    newTab[e.hash & (newCap - 1)] = e;  // 直接将节点放到新表中的相应位置
                else if (e instanceof TreeNode)  // 如果当前桶是树节点
                    ((TreeNode<K,V>)e).split(this, newTab, j, oldCap);  // 调用split方法，将树节点拆分并放到新表中
                else {  // 如果当前桶是链表节点，按位重新分配
                    Node<K,V> loHead = null, loTail = null;  // 低位链表的头尾节点
                    Node<K,V> hiHead = null, hiTail = null;  // 高位链表的头尾节点
                    Node<K,V> next;
                    do {
                        next = e.next;  // 记录下一个节点
                        if ((e.hash & oldCap) == 0) {  // 如果哈希值与旧容量按位与为0，放到低位链表
                            if (loTail == null)
                                loHead = e;
                            else
                                loTail.next = e;
                            loTail = e;
                        }
                        else {  // 否则放到高位链表
                            if (hiTail == null)
                                hiHead = e;
                            else
                                hiTail.next = e;
                            hiTail = e;
                        }
                    } while ((e = next) != null);  // 遍历整个链表

                    if (loTail != null) {  // 如果低位链表不为空
                        loTail.next = null;  // 终止链表
                        newTab[j] = loHead;  // 将低位链表放到新表中的相应位置
                    }
                    if (hiTail != null) {  // 如果高位链表不为空
                        hiTail.next = null;  // 终止链表
                        newTab[j + oldCap] = hiHead;  // 将高位链表放到新表中的相应位置
                    }
                }
            }
        }
    }
    return newTab;  // 返回新表
}

```



### 为什么都要比较两次？

```java
// 先用'=='比较key对象的内存地址，如果地址相同则肯定是同一个对象
// 如果不是同一个对象，再用'equals'比较对象的内容，如果内容相同
(k = p.key) == key || (key != null && key.equals(k))
(v = e.value) == value || (value != null && value.equals(v)) //containsValue方法
```



## 自己写一个HashMap

写个数组+链表，只能拉链法解决冲突的简易版

```java
import java.io.Serializable;

public class FredMap<K, V> implements Serializable {

    static class Node<K, V> implements Serializable{
        final K key;
        V value;
        Node<K, V> next;

        Node(K key, V value, Node<K, V> next) {
            this.key = key;
            this.value = value;
            this.next = next;
        }
    }

    private static final float LOAD_FACTOR = 0.75F;

    private static final int INIT_CAPACITY = 1 << 4;

    private int size;

    private Node<K, V>[] table;

    public FredMap() {
    }

    private static int hash(Object key) {
        int h;
        return key == null ? 0 : (h = key.hashCode()) ^ (h >>> 16);
    }

    public V put(K key, V value) {
        if (table == null) {
            table = new Node[INIT_CAPACITY];
        }
        int hash = hash(key);
        Node<K, V> node = table[hash];
        while (node != null) {
            if (node.key.equals(key)) {//若存在重复key
                V oldValue = node.value;
                node.value = value;
                return oldValue;
            }
            node = node.next;
        }
        table[hash] = new Node<K, V>(key, value, table[hash]);//头插法
        size += 1;
        if (size > LOAD_FACTOR * table.length) {
            resize();
        }
        return null;
    }

    private void resize() {
        int newCapacity = table.length * 2;
        Node<K, V>[] oldTable = table;
        table = new Node[newCapacity];
        size = 0;
        for (Node<K, V> node : oldTable) {
            while (node != null) {
                put(node.key, node.value);
                node = node.next;
            }
        }
    }

    public V get(K key) {
        int hash = hash(key);
        Node<K, V> node = table[hash];
        while (node != null) {
            if (node.key.equals(key)) {
                return node.value;
            }
            node = node.next;
        }
        return null;
    }

    public V remove(K key) {
        int hash = hash(key);
        Node<K, V> node = table[hash];
        Node<K, V> prev = null;
        while (node != null) {
            if (node.key.equals(key)) {
                V returnValue =  node.value;
                if (prev == null) {
                    table[hash] = node.next;
                } else {
                    prev.next = node.next;
                }
                size -= 1;
                return returnValue;
            }
            prev = node;
            node = node.next;
        }
        return null;
    }

    public int size() {
        return size;
    }

    public boolean isEmpty() {
        return size == 0;
    }
}
```

