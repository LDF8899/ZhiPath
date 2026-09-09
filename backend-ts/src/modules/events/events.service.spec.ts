import { EventsService } from './events.service';

describe('EventsService tenant scoping', () => {
  it('does not deliver events between tenants sharing a user id', (done) => {
    const service = new EventsService();
    const tenantOne: any[] = [];
    const tenantTwo: any[] = [];
    const first = service.getEventStream(42, 1).subscribe((event) => tenantOne.push(event));
    const second = service.getEventStream(42, 2).subscribe((event) => tenantTwo.push(event));

    service.emit(42, { type: 'tenant_one', data: {} }, 1);
    service.emit(42, { type: 'tenant_two', data: {} }, 2);

    expect(tenantOne.some((event) => event.type === 'tenant_one')).toBe(true);
    expect(tenantOne.some((event) => event.type === 'tenant_two')).toBe(false);
    expect(tenantTwo.some((event) => event.type === 'tenant_two')).toBe(true);
    expect(tenantTwo.some((event) => event.type === 'tenant_one')).toBe(false);
    first.unsubscribe();
    second.unsubscribe();
    done();
  });
});
