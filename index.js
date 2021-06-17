/// This code is based on MIT licensed code from: https://github.com/PostHog/event-sequence-timer-plugin

function setupPlugin({config, global}) {
    if (config.eventsToTrack.includes(' ')) {
        throw new Error('No spaces allowed in events list.')
    }
    try {
        let eventsToTrack = {}
        let firstStepEvents = new Set()
        const eventSets = config.eventsToTrack.replace(/\),/g, ')|').split('|')
        for (let eventSet of eventSets) {
            const [eventA, eventB] = eventSet.slice(1,eventSet.length-1).split(',')
            firstStepEvents.add(eventA)
            if (eventsToTrack[eventB]) {
                eventsToTrack[eventB].add(eventA)
            } else {
                eventsToTrack[eventB] = new Set([eventA])
            }
        }
        global.eventsToTrack = eventsToTrack
        global.firstStepEvents = firstStepEvents
    } catch {
        throw new Error('Unable to parse your config. Please make sure you are using the commas and parentheses correctly.')
    }
}


async function processEvent(event, { config, global, storage }) {
    const timestamp = new Date(event.timestamp || event.data?.timestamp || event.properties?.timestamp || event.now || event.sent_at || event.properties?.['$time']).getTime()
    if (timestamp) {
        if (global.firstStepEvents.has(event.event)) {
            if(event.properties.task_id){
                const existingTimestamp = await storage.get(`${event.event}_${event.properties.task_id}`)
                if (!existingTimestamp || (existingTimestamp && config.updateTimestamp === "Yes")) {
                    await storage.set(`${event.event}_${event.properties.task_id}`, timestamp)
                }
            }
        }
        if (global.eventsToTrack[event.event]) {
            for (let eventA of Array.from(global.eventsToTrack[event.event])) {
                if(event.properties.task_id){
                    const storedTimestamp = await storage.get(`${eventA}_${event.properties.task_id}`)
                    if (storedTimestamp) {
                        const DAY = 1000 * 60 * 60 * 24;
                        let interval = timestamp - Number(storedTimestamp);
                        
                        event.properties[`time_since_${eventA}`] = interval/DAY;
                        event.properties[`time_since_${eventA}_readable`] = msToReadableTime(interval);
                    }
                }
            }
        }
    }
    return event;
}

function msToReadableTime(duration) {
  var second = Math.floor(duration / 1000) % 60;
  var minute = Math.floor(duration / (1000 * 60)) % 60;
  var hour = Math.floor(duration/(1000 * 60 * 60)) % 24;
  var day = Math.floor(duration/(1000 * 60 * 60 * 24));

  return day+'day '+hour+'hr '+minute+'min '+second+'sec';
}
