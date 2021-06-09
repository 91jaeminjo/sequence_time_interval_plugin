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
                    const existingTimestamp = await storage.get(`${event.event}_${event.distinct_id}`)
                    if (!existingTimestamp || (existingTimestamp && config.updateTimestamp === "Yes")) {
                        await storage.set(`${event.event}_${event.properties.task_id}`, timestamp)
                    }
                }
                if(event.properties.userName){
                    event.properties['test']=event.userName;
                }
            }
            if (global.eventsToTrack[event.event]) {
                for (let eventA of Array.from(global.eventsToTrack[event.event])) {
                    if(eventA.properties.task_id){
                        const storedTimestamp = await storage.get(`${eventA}_${event.properties.task_id}`)
                        if (storedTimestamp) {
                            event.properties[`time_since_${eventA}`] = timestamp - Number(storedTimestamp)
                        }
                    }
                }
            }
        }
    return event
}
