import { destroyDOM } from './destroy-dom'
import { mountDOM } from './mount-dom'
import { patchDOM } from './patch-dom'
import { DOM_TYPES, extractChildren, didCreateSlot, resetDidCreateSlot} from './h'
import { hasOwnProperty } from './utils/objects'
import equal from 'fast-deep-equal'
import { Dispatcher } from './dispatcher'
import { fillSlots } from './slots'

//TODO: implement more lifecycle hooks 
//TODO: try to change how components init

const emptyFn = () => {}

export function defineComponent({ render, state, onMounted = emptyFn, onUnmounted = emptyFn, ...methods  }) {
  class Component {
    #isMounted = false;
    #vdom = null;
    #hostEl = null;
    #eventHandlers = null
    #parentComponent = null 
    #dispatcher = new Dispatcher()
    #subscriptions = []

    #children = []

    constructor(props = {}, eventHandlers = {}, parentComponent = null) {
      this.props = props;
      this.state = state ? state(props) : {};
      this.#eventHandlers = eventHandlers;
      this.#parentComponent = parentComponent;
    }

    setExternalContent(children) {
      this.#children = children;
    }   

    onMounted() {
      return Promise.resolve(onMounted.call(this))
    }

    onUnmounted() {
      return Promise.resolve(onUnmounted.call(this))
    }

    #wireEventHandlers() {
      this.#subscriptions = Object.entries(this.#eventHandlers).map(
        ([eventName, handler]) => this.#wireEventHandler(eventName, handler)
      );
    }

    #wireEventHandler(eventName, handler) {
      return this.#dispatcher.subscribe(eventName, (payload) => {
        if (this.#parentComponent) {
          handler.call(this.#parentComponent, payload);
        } else {
          handler(payload);
        }
      });
    }

    emit(eventName, payload) {
      this.#dispatcher.dispatch(eventName, payload);
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
      const newProps = { ...this.props, ...props }
      if (equal(this.props, newProps)) {
        return
      }

      this.props = newProps;
      this.#patch()
    }

    updateState(state) {
      this.state = { ...this.state, ...state };
      this.#patch();
    }

    render() {
      const vdom = render.call(this)
      if (didCreateSlot()) {
        fillSlots(vdom, this.#children)
        resetDidCreateSlot()
      }
      return vdom
    }

    mount(hostEl, index = null) {
      if (this.#isMounted) {
        throw new Error("Component is already mounted");
      }

      this.#vdom = this.render();
      mountDOM(this.#vdom, hostEl, index, this);
      this.#wireEventHandlers(); 

      this.#hostEl = hostEl;
      this.#isMounted = true;
    }

    unmount() {
      if (!this.#isMounted) {
        throw new Error("Component is not mounted");
      }
      destroyDOM(this.#vdom);
      this.#subscriptions.forEach((unsubscribe) => unsubscribe());

      this.#vdom = null;
      this.#hostEl = null;
      this.#isMounted = false;
      this.#subscriptions = [];
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
    Component.prototype[methodName] = methods[methodName]
  }

    
  return Component;
}