import { useState } from 'react'

import { SearchInput } from '@/components/search-input'

import { Row, Rows, type DemoMeta } from '../demo'

export const meta: DemoMeta = {
  title: 'Search input',
  components: ['input'],
  custom: { file: 'src/renderer/components/search-input.tsx', exports: 'SearchInput' },
}

export default function SearchInputDemo() {
  const [empty, setEmpty] = useState('')
  const [filled, setFilled] = useState('aurora')
  return (
    <Rows>
      <Row label="empty" className="block">
        <SearchInput
          className="max-w-80"
          placeholder="Search wallpapers..."
          searchQuery={empty}
          setSearchQuery={setEmpty}
        />
      </Row>
      <Row label="filled" className="block">
        <SearchInput
          className="max-w-80"
          placeholder="Search wallpapers..."
          searchQuery={filled}
          setSearchQuery={setFilled}
        />
      </Row>
    </Rows>
  )
}
