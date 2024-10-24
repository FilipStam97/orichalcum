import { createApp, h, hFragment,defineComponent } from '../../packages/runtime/dist/orichalcum.js';
  
const App = defineComponent({
  state() {
    return {
      count: 0,
      countList: []
    }
  },

  render() {
    const { count, countList } = this.state

    return hFragment([
      h('h1', {}, ['Counter']),
      h(Counter, {
        count,
        on: {
          increment: this.incrementCounter,
        },
      }),
      h(CountList, {
        countList,
        on: {
          remove: this.removeItem,
        },
      }),
    ])
  },

  incrementCounter() {
    const countItem = { id: crypto.randomUUID(), value: this.state.count + 1 }
    this.updateState({ count: this.state.count + 1,  countList: [...this.state.countList, countItem] })
  },

  removeItem(idx) {
    const newCountList = [...this.state.countList]
    newCountList.splice(idx, 1)
    this.updateState({ count: this.state.count - 1,  countList: newCountList })
  },

})

const Counter = defineComponent({

  render() {
    const { count } = this.props
    return h('div', {}, [
      h(
        'button',
        {
          on: { click: this.increment },
        },
        ['Increment']
      ),
      h('span', {}, [`${count}`]),
    ])
  },

  increment() {
    this.emit('increment')

  },
})

const CountList = defineComponent({
  render() {
    const { countList } = this.props

    return h(
      'ul',
      {},
      countList.map((item, i) =>
        h(CountItem, {
          key: item.id,
          value: item.value,
          i,
          on: {
            remove: (i) => this.emit('remove', i),
          },
        })
      )
    )
  },
})

const CountItem = defineComponent({
  render() {
    const { value } = this.props

    return h('li', {}, [
      h('span', {}, [`${value}`]),
      h(
        'button',
        { on: { click: () => this.emit('remove', this.props.i) } },
        ['Remove']
      ),
    ])

  },

 
})

createApp(App).mount(document.body)