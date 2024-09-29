function addEventListener(eventName, handler, el,  hostComponent = null) {
    function boundHandler() {
        hostComponent
            ? handler.apply(hostComponent, arguments)
            : handler(...arguments);
    }
    el.addEventListener(eventName, boundHandler);
    return boundHandler;
}
function addEventListeners(listeners = {}, el,  hostComponent = null) {
    const addedListeners = {};
    Object.entries(listeners).forEach(([eventName, handler]) => {
    const listener = addEventListener(eventName, handler, el, hostComponent);
    addedListeners[eventName] = listener;
    });
    return addedListeners
}
function removeEventListeners(listeners = {}, el) {
    Object.entries(listeners).forEach(([eventName, handler]) => {
        el.removeEventListener(eventName, handler);
    });
}

const ARRAY_DIFF_OP = {
    ADD: 'add',
    REMOVE: 'remove',
    MOVE: 'move',
    NOOP: 'noop',
};
function withoutNulls(arr) {
    return arr.filter((item) => item != null)
   }
function arraysDiff(oldArr, newArr) {
    return {
        added: newArr.filter((newItem) => !oldArr.includes(newItem)),
        removed: oldArr.filter((oldItem) => !newArr.includes(oldItem))
    }
}
class ArrayWithOriginalIndices {
    #array = []
    #originalIndices = []
    #equalsFn
    constructor(array, equalsFn) {
        this.#array = [...array];
        this.#originalIndices = array.map((_, i) => i);
        this.#equalsFn = equalsFn;
    }
    get length() {
        return this.#array.length
    }
    originalIndexAt(index) {
        return this.#originalIndices[index]
    }
    isRemoval(index, newArray) {
      if (index >= this.length) {
        return false;
      }
      const item = this.#array[index];
      const indexInNewArray = newArray.findIndex((newItem) =>
        this.#equalsFn(item, newItem)
      );
      return indexInNewArray === -1;
    }
    isNoop(index, newArray) {
      if (index >= this.length) {
        return false;
      }
      const item = this.#array[index];
      const newItem = newArray[index];
      return this.#equalsFn(item, newItem);
    }
    isAddition(item, fromIdx) {
        return this.findIndexFrom(item, fromIdx) === -1
    }
    findIndexFrom(item, fromIndex) {
      for (let i = fromIndex; i < this.length; i++) {
        if (this.#equalsFn(item, this.#array[i])) {
          return i;
        }
      }
      return -1;
    }
    removeItem(index) {
        const operation = {
        op: ARRAY_DIFF_OP.REMOVE,
        index,
        item: this.#array[index],
        };
        this.#array.splice(index, 1);
        this.#originalIndices.splice(index, 1);
        return operation
    }
    noopItem(index) {
      return {
        op: ARRAY_DIFF_OP.NOOP,
        originalIndex: this.originalIndexAt(index),
        index,
        item: this.#array[index],
      };
    }
    addItem(item, index) {
      const operation = {
        op: ARRAY_DIFF_OP.ADD,
        index,
        item,
      };
      this.#array.splice(index, 0, item);
      this.#originalIndices.splice(index, 0, -1);
      return operation;
    }
    moveItem(item, toIndex) {
      const fromIndex = this.findIndexFrom(item, toIndex);
      const operation = {
        op: ARRAY_DIFF_OP.MOVE,
        originalIndex: this.originalIndexAt(fromIndex),
        from: fromIndex,
        index: toIndex,
        item: this.#array[fromIndex],
      };
      const [_item] = this.#array.splice(fromIndex, 1);
      this.#array.splice(toIndex, 0, _item);
      const [originalIndex] = this.#originalIndices.splice(fromIndex, 1);
      this.#originalIndices.splice(toIndex, 0, originalIndex);
      return operation;
    }
    removeItemsAfter(index) {
      const operations = [];
      while (this.length > index) {
        operations.push(this.removeItem(index));
      }
      return operations;
    }
}
function arraysDiffSequence(
    oldArray,
    newArray,
    equalsFn = (a, b) => a === b
   ) {
     const sequence = [];
     const array = new ArrayWithOriginalIndices(oldArray, equalsFn);
     for (let index = 0; index < newArray.length; index++) {
        if (array.isRemoval(index, newArray)) {
            sequence.push(array.removeItem(index));
            index--;
            continue
        }
        if (array.isNoop(index, newArray)) {
            sequence.push(array.noopItem(index));
            continue
        }
        const item = newArray[index];
        if (array.isAddition(item, index)) {
            sequence.push(array.addItem(item, index));
            continue
        }
        sequence.push(array.moveItem(item, index));
     }
     sequence.push(...array.removeItemsAfter(newArray.length));
     return sequence;
   }

const DOM_TYPES = {
    TEXT: 'text',
    ELEMENT: 'element',
    FRAGMENT: 'fragment',
    COMPONENT: 'component',
};
function h(tag, props = {}, children = []) {
  const type =
      typeof tag === 'string' ? DOM_TYPES.ELEMENT : DOM_TYPES.COMPONENT;
    return {
    tag,
    props,
    children: mapTextNodes(withoutNulls(children)),
    type
    }
}
function mapTextNodes(children) {
    return children.map((child) =>
    typeof child === 'string' ? hString(child) : child
    )
}
function hString(str) {
    return { type: DOM_TYPES.TEXT, value: str }
 }
function hFragment(vNodes) {
    return {
    type: DOM_TYPES.FRAGMENT,
    children: mapTextNodes(withoutNulls(vNodes)),
    }
}
function extractChildren(vdom) {
  if (vdom.children == null) {
    return [];
  }
  const children = [];
  for (const child of vdom.children) {
    if (child.type === DOM_TYPES.FRAGMENT) {
      children.push(...extractChildren(child));
    } else {
      children.push(child);
    }
  }
  return children;
}

function destroyDOM(vdom) {
    const { type } = vdom;
    switch (type) {
        case DOM_TYPES.TEXT: {
            removeTextNode(vdom);
            break;
        }
        case DOM_TYPES.ELEMENT: {
            removeElementNode(vdom);
            break;
        }
        case DOM_TYPES.FRAGMENT: {
            removeFragmentNode(vdom);
            break;
        }
        case DOM_TYPES.COMPONENT: {
            vdom.component.unmount();
            break
        }
        default: {
            throw new Error(`Can't destroy DOM of type: ${type}`);
        }
    }
    delete vdom.el;
}
function removeTextNode(vdom) {
    const { el } = vdom;
    el.remove();
}
function removeElementNode(vdom) {
    const { el, children, listeners } = vdom;
    el.remove();
    children.forEach(destroyDOM);
    if (listeners) {
        removeEventListeners(listeners, el);
        delete vdom.listeners;
    }
}
function removeFragmentNode(vdom) {
    const { children } = vdom;
    children.forEach(destroyDOM);
}

function setAttributes(el, attrs) {
    const {class: className, style, ...otherAttrs} = attrs;
    if(className) {
        setClass(el, className);
    }
    if(style) {
        Object.entries(style).forEach(([prop, value]) => {
            setStyle(el, prop, value);
        });
    }
    Object.entries(otherAttrs).forEach(([name, value]) => setAttribute(el, name, value));
}
function setClass(el, className) {
    el.className = '';
    if(typeof className === 'string') {
        el.className = className;
    }
    if(Array.isArray(className)) {
        el.classList.add(...className);
    }
}
function setStyle(el, name, value) {
    el.style[name] = value;
}
function removeStyle(el, name) {
    el.style[name] = null;
}
function setAttribute(el, name, value) {
    if (value == null) {
    removeAttribute(el, name);
    } else if (name.startsWith('data-')) {
    el.setAttribute(name, value);
    } else {
    el[name] = value;
    }
}
function removeAttribute(el, name) {
    el[name] = null;
    el.removeAttribute(name);
}

function mountDOM(vdom, parentEl, index, hostComponent = null) {
    switch(vdom.type) {
        case DOM_TYPES.TEXT: {
            createTextNode(vdom, parentEl, index);
            break;
        }
        case DOM_TYPES.ELEMENT: {
            createElementNode(vdom, parentEl, index, hostComponent);
            break;
        }
        case DOM_TYPES.FRAGMENT: {
            createFragmentNodes(vdom, parentEl, index, hostComponent);
            break;
        }
        case DOM_TYPES.COMPONENT: {
            createComponentNode(vdom, parentEl, index);
            break
        }
        default: {
            throw new Error(`Can't mount DOM of type: ${vdom.type}`);
        }
    }
}
function createTextNode(vdom, parentEl, index) {
    const {value} = vdom;
    const txtNode = document.createTextNode(value);
    vdom.el = txtNode;
    insert(txtNode, parentEl, index);
}
function createFragmentNodes(vdom, parentEl, index, hostComponent) {
    const {children} = vdom;
    vdom.el = parentEl;
    children.forEach((child, i) =>
        mountDOM(child, parentEl, index ? index + i : null, hostComponent)
    );
}
function createElementNode(vdom, parentEl, index, hostComponent) {
    const {tag, props, children} = vdom;
    const el = document.createElement(tag);
    addProps(el, props, vdom, hostComponent);
    vdom.el = el;
    children.forEach(element => mountDOM(element, el, null, hostComponent));
    insert(el, parentEl, index);
}
function createComponentNode(vdom, parentEl, index, hostComponent) {
  const Component = vdom.tag;
  const props = vdom.props;
  const component = new Component(props);
  component.mount(parentEl, index);
  vdom.component = component;
  vdom.el = component.firstElement;
}
function addProps(el, props, vdom, hostComponent) {
    const {on: events, ...attrs} = props;
    vdom.listeners = addEventListeners(events, el, hostComponent);
    setAttributes(el, attrs);
}
function insert(el, parentEl, index) {
  if (index == null) {
    parentEl.append(el);
    return;
  }
  if (index < 0) {
    throw new Error(`Index must be a positive integer, got ${index}`);
  }
  const children = parentEl.childNodes;
  if (index >= children.length) {
    parentEl.append(el);
  } else {
    parentEl.insertBefore(el, children[index]);
  }
}

class Dispatcher {
    #subs = new Map();
    #afterHandlers = []
    subscribe(commandName, handler) {
        if(!this.#subs.has(commandName)) {
            this.#subs.set(commandName, []);
        }
        const handlers = this.#subs.get(commandName);
        if(handlers.includes(handler)) {
            return () => {};
        }
        handlers.push(handler);
        return () => {
            const idx = handlers.indexOf(handler);
            handlers.splice(idx, 1);
        }
    }
    afterEveryCommand(handler) {
        this.#afterHandlers.push(handler);
        return () => {
            const idx = this.#afterHandlers.indexOf(handler);
            this.#afterHandlers.splice(idx, 1);
        }
    }
    dispatch(commandName, payload) {
        if (this.#subs.has(commandName)) {
            this.#subs.get(commandName).forEach((handler) => handler(payload));
        } else {
            console.warn(`No handlers for command: ${commandName}`);
        }
        this.#afterHandlers.forEach((handler) => handler());
    }
}

function areNodesEqual(nodeOne, nodeTwo) {
  if (nodeOne.type !== nodeTwo.type) {
    return false;
  }
  if (nodeOne.type === DOM_TYPES.ELEMENT) {
    const { tag: tagOne } = nodeOne;
    const { tag: tagTwo } = nodeTwo;
    return tagOne === tagTwo;
  }
  return true;
}

function objectsDiff(oldObj, newObj) {
    const oldKeys = Object.keys(oldObj);
    const newKeys = Object.keys(newObj);
    return {
        added: newKeys.filter((key) => !(key in oldObj)),
        removed: oldKeys.filter((key) => !(key in newObj)),
        updated: newKeys.filter((key) => key in oldObj && oldObj[key] !== newObj[key]),
    }
}
function hasOwnProperty(obj, prop) {
    return Object.prototype.hasOwnProperty.call(obj, prop)
}

function isNotEmptyString(str) {
    return str !== ''
}
function isNotBlankOrEmptyString(str) {
     return isNotEmptyString(str.trim());
}

function patchDOM(oldVdom, newVdom, parentEl, hostComponent = null) {
    if (!areNodesEqual(oldVdom, newVdom)) {
        const index = findIndexInParent(parentEl, oldVdom.el);
        destroyDOM(oldVdom);
        mountDOM(newVdom, parentEl, index, hostComponent);
        return newVdom
    }
    newVdom.el = oldVdom.el;
    switch (newVdom.type) {
        case DOM_TYPES.TEXT: {
            patchText(oldVdom, newVdom);
            return newVdom
        }
        case DOM_TYPES.ELEMENT: {
            patchElement(oldVdom, newVdom, hostComponent);
            break
        }
        case DOM_TYPES.COMPONENT: {
          patchComponent(oldVdom, newVdom);
          break
        }
    }
    patchChildren(oldVdom, newVdom, hostComponent);
    return newVdom;
}
function findIndexInParent(parentEl, el) {
    const index = Array.from(parentEl.childNodes).indexOf(el);
    if (index < 0) {
        return null
    }
    return index
}
function patchText(oldVdom, newVdom) {
    const el = oldVdom.el;
    const { value: oldText } = oldVdom;
    const { value: newText } = newVdom;
    if (oldText !== newText) {
        el.nodeValue = newText;
    }
}
function patchElement(oldVdom, newVdom, hostComponent) {
  const el = oldVdom.el;
  const {
    class: oldClass,
    style: oldStyle,
    on: oldEvents,
    ...oldAttrs
  } = oldVdom.props;
  const {
    class: newClass,
    style: newStyle,
    on: newEvents,
    ...newAttrs
  } = newVdom.props;
  const { listeners: oldListeners } = oldVdom;
  patchAttrs(el, oldAttrs, newAttrs);
  patchClasses(el, oldClass, newClass);
  patchStyles(el, oldStyle, newStyle);
  newVdom.listeners = patchEvents(el, oldListeners, oldEvents, newEvents, hostComponent);
}
function patchAttrs(el, oldAttrs, newAttrs) {
  const { added, removed, updated } = objectsDiff(oldAttrs, newAttrs);
  for (const attr of removed) {
    removeAttribute(el, attr);
  }
  for (const attr of added.concat(updated)) {
    setAttribute(el, attr, newAttrs[attr]);
  }
}
function patchClasses(el, oldClass, newClass) {
  const oldClasses = toClassList(oldClass);
  const newClasses = toClassList(newClass);
  const { added, removed } = arraysDiff(oldClasses, newClasses);
  if (removed.length > 0) {
    el.classList.remove(...removed);
  }
  if (added.length > 0) {
    el.classList.add(...added);
  }
}
function toClassList(classes = '') {
  return Array.isArray(classes)
    ? classes.filter(isNotBlankOrEmptyString)
    : classes.split(/(\s+)/).filter(isNotBlankOrEmptyString);
}
function patchStyles(el, oldStyle = {}, newStyle = {}) {
  const { added, removed, updated } = objectsDiff(oldStyle, newStyle);
  for (const style of removed) {
    removeStyle(el, style);
  }
  for (const style of added.concat(updated)) {
    setStyle(el, style, newStyle[style]);
  }
}
function patchEvents(
    el,
    oldListeners = {},
    oldEvents = {},
    newEvents = {},
    hostComponent
   ) {
     const { removed, added, updated } = objectsDiff(oldEvents, newEvents);
     for (const eventName of removed.concat(updated)) {
       el.removeEventListener(eventName, oldListeners[eventName]);
     }
     const addedListeners = {};
     for (const eventName of added.concat(updated)) {
       const listener = addEventListener(eventName, newEvents[eventName], el, hostComponent);
       addedListeners[eventName] = listener;
     }
     return addedListeners;
}
function patchChildren(oldVdom, newVdom, hostComponent) {
  const oldChildren = extractChildren(oldVdom);
  const newChildren = extractChildren(newVdom);
  const parentEl = oldVdom.el;
  const diffSeq = arraysDiffSequence(oldChildren, newChildren, areNodesEqual);
  for (const operation of diffSeq) {
    const { originalIndex, index, item } = operation;
    const offset = hostComponent?.offset ?? 0;
    switch (operation.op) {
      case ARRAY_DIFF_OP.ADD: {
        mountDOM(item, parentEl, index + offset, hostComponent);
        break
      }
      case ARRAY_DIFF_OP.REMOVE: {
        destroyDOM(item);
        break
      }
      case ARRAY_DIFF_OP.MOVE: {
        const oldChild = oldChildren[originalIndex];
        const newChild = newChildren[index];
        const el = oldChild.el;
        const elAtTargetIndex = parentEl.childNodes[index + offset];
        parentEl.insertBefore(el, elAtTargetIndex);
        patchDOM(oldChild, newChild, parentEl, hostComponent);
        break
      }
      case ARRAY_DIFF_OP.NOOP: {
        patchDOM(oldChildren[originalIndex], newChildren[index], parentEl, hostComponent);
        break
      }
    }
  }
}
function patchComponent(oldVdom, newVdom) {
  const { component } = oldVdom;
  const { props } = newVdom;
  component.updateProps(props);
  newVdom.component = component;
  newVdom.el = component.firstElement;
}

function createApp({ state, view,  reducers = {} }) {
    let parentEl = null;
    let vdom = null;
    let isMounted = false;
    const dispatcher = new Dispatcher();
    const subscriptions = [dispatcher.afterEveryCommand(renderApp)];
    function emit(eventName, payload) {
        dispatcher.dispatch(eventName, payload);
    }
    for (const actionName in reducers) {
        const reducer = reducers[actionName];
        const subs = dispatcher.subscribe(actionName, (payload) => {
            state = reducer(state, payload);
        });
        subscriptions.push(subs);
    }
    function renderApp() {
        const newVdom = view(state, emit);
        vdom = patchDOM(vdom, newVdom, parentEl);
    }
    return {
        mount(_parentEl) {
            if (isMounted) {
                throw new Error('The application is already mounted');
            }
            parentEl = _parentEl;
            vdom = view(state, emit);
            mountDOM(vdom, parentEl);
            isMounted = true;
        },
        unmount() {
            destroyDOM(vdom);
            vdom = null;
            subscriptions.forEach((unsubscribe) => unsubscribe());
            isMounted = false;
        },
    }
}

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var fastDeepEqual = function equal(a, b) {
  if (a === b) return true;
  if (a && b && typeof a == 'object' && typeof b == 'object') {
    if (a.constructor !== b.constructor) return false;
    var length, i, keys;
    if (Array.isArray(a)) {
      length = a.length;
      if (length != b.length) return false;
      for (i = length; i-- !== 0;)
        if (!equal(a[i], b[i])) return false;
      return true;
    }
    if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
    if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
    if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();
    keys = Object.keys(a);
    length = keys.length;
    if (length !== Object.keys(b).length) return false;
    for (i = length; i-- !== 0;)
      if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;
    for (i = length; i-- !== 0;) {
      var key = keys[i];
      if (!equal(a[key], b[key])) return false;
    }
    return true;
  }
  return a!==a && b!==b;
};
var equal = getDefaultExportFromCjs(fastDeepEqual);

function defineComponent({ render, state, ...methods  }) {
  class Component {
    #isMounted = false;
    #vdom = null;
    #hostEl = null;
    constructor(props = {}) {
      this.props = props;
      this.state = state ? state(props) : {};
    }
    get elements() {
      if (this.#vdom == null) {
        return [];
      }
      if (this.#vdom.type === DOM_TYPES.FRAGMENT) {
        return extractChildren(this.#vdom).flatMap((child) => {
          if (child.type === DOM_TYPES.COMPONENT) {
            return child.component.elements
          }
            return [child.el]
          })
      }
      return [this.#vdom.el];
    }
    get firstElement() {
      return this.elements[0];
    }
    get offset() {
      if (this.#vdom.type === DOM_TYPES.FRAGMENT) {
        return Array.from(this.#hostEl.children).indexOf(this.firstElement);
      }
      return 0;
    }
    updateProps(props) {
      const newProps = { ...this.props, ...props };
      if (equal(this.props, newProps)) {
        return
      }
      this.props = newProps;
      this.#patch();
    }
    updateState(state) {
      this.state = { ...this.state, ...state };
      this.#patch();
    }
    render() {
      return render.call(this);
    }
    mount(hostEl, index = null) {
      if (this.#isMounted) {
        throw new Error("Component is already mounted");
      }
      this.#vdom = this.render();
      mountDOM(this.#vdom, hostEl, index, this);
      this.#hostEl = hostEl;
      this.#isMounted = true;
    }
    unmount() {
      if (!this.#isMounted) {
        throw new Error("Component is not mounted");
      }
      destroyDOM(this.#vdom);
      this.#vdom = null;
      this.#hostEl = null;
      this.#isMounted = false;
    }
    #patch() {
      if (!this.#isMounted) {
        throw new Error("Component is not mounted");
      }
      const vdom = this.render();
      this.#vdom = patchDOM(this.#vdom, vdom, this.#hostEl, this);
    }
  }
  for (const methodName in methods) {
    if (hasOwnProperty(Component, methodName)) {
    throw new Error(`Method "${methodName}()" already exists in the component.`);
    }
    Component.prototype[methodName] = methods[methodName];
  }
  return Component;
}

console.log('This will soon be a frontend framework!');

export { createApp, defineComponent, h, hFragment, hString };
