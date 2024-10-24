import { DOM_TYPES } from "./h";
import { setAttributes } from './attributes'
import { addEventListeners } from './events'
import { extractPropsAndEvents } from './utils/props'
import { enqueueJob } from './scheduler' 


export function mountDOM(vdom, parentEl, index, hostComponent = null) {
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
            createComponentNode(vdom, parentEl, index, hostComponent);
            enqueueJob(() => vdom.component.onMounted());
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

    insert(txtNode, parentEl, index)
}

function createFragmentNodes(vdom, parentEl, index, hostComponent) {
    const {children} = vdom;
    vdom.el = parentEl;

    children.forEach((child, i) =>
        mountDOM(child, parentEl, index ? index + i : null, hostComponent)
    )

}

function createElementNode(vdom, parentEl, index, hostComponent) {
    const { tag, children } = vdom;

    const el = document.createElement(tag);
    addProps(el, vdom, hostComponent);
    vdom.el = el;

    children.forEach(element => mountDOM(element, el, null, hostComponent));
    insert(el, parentEl, index)
}

function createComponentNode(vdom, parentEl, index, hostComponent) {
  const { tag: Component, children } = vdom
  const { props, events } = extractPropsAndEvents(vdom) 

  const component = new Component(props, events, hostComponent) 
  component.setExternalContent(children)
  
  component.mount(parentEl, index);
  vdom.component = component;
  vdom.el = component.firstElement;
}

function addProps(el, vdom, hostComponent) {
    const { props: attrs, events } = extractPropsAndEvents(vdom);
    vdom.listeners = addEventListeners(events, el, hostComponent);
    setAttributes(el, attrs);
}

function insert(el, parentEl, index) {
  // If index is null or undefined, simply append.
  // Note the usage of == instead of ===.
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

