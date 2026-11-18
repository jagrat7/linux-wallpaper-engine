import {
  Carousel,
  CarouselButtons,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'

import { Row, Rows, type DemoMeta } from '../demo'

export const meta: DemoMeta = { title: 'Carousel', components: ['carousel'] }

const SLIDES = ['Aurora Borealis', 'Rainy Tokyo', 'Clock Tower', 'Deep Space']

export default function CarouselDemo() {
  return (
    <Rows>
      <Row label="outside" className="block px-12">
        <Carousel opts={{ align: 'start' }}>
          <CarouselContent>
            {SLIDES.map((slide) => (
              <CarouselItem key={slide} className="basis-1/2">
                <div className="bg-muted text-muted-foreground grid aspect-video place-items-center rounded-lg text-sm">
                  {slide}
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </Row>
      <Row label="inside" className="block">
        <Carousel className="max-w-72">
          <CarouselContent>
            {SLIDES.map((slide) => (
              <CarouselItem key={slide}>
                <div className="bg-muted text-muted-foreground grid aspect-video place-items-center rounded-lg text-sm">
                  {slide}
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselButtons />
        </Carousel>
      </Row>
    </Rows>
  )
}
