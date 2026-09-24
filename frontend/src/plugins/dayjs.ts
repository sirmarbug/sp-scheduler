import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/pl'

dayjs.extend(isoWeek)
dayjs.extend(localizedFormat)
dayjs.extend(relativeTime)
dayjs.locale('pl')

export default dayjs
