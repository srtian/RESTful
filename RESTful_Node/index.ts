const http = require('http');
const url = require('url').URL;
const querystring = require('querystring');
const rq = require('request-promise'); 
const baseMongo = require('./lib/baseMongodb')();


type method = 'GET' | 'HEAD' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
const server = http.createServer(async(req, res) => {
    const myUrl = new URL(req.url, `http://${req.headers.host}`)
    const pathname = myUrl.pathname
    if('/v1/contents' !== pathname) {
        return setResInfo(res, false, 'path not found', null, 404)
    }
    let contents = await queryData({})
    contents = await filterUserInfo(contents)
    return setResInfo(res, true, 'success', contents)
})

async function filterUserInfo(contents: Array<any>) {
    let userIds = []
    contents.forEach(content => {
        if(content['user_id']) {
            userIds.push(content['user_id'])
        }
    })
    if(userIds.length < 1) {
        return addUserInfo(contents)
    }
    let userInfos = await callApi('http://127.0.0.1:5000/v1/userinfos', {user_ids: userIds.join(',')})
    if(!userInfos || userInfos.length < 1) {
        return addUserInfo(contents)
    }
    let mapUserInfo = {}
    userInfos.forEach(item => {
        if(userIds.includes(item.id)) {
            mapUserInfo[item.id] = item
        }
    })
    return addUserInfo(contents, mapUserInfo)
}

async function addUserInfo(contents: Array<any>, mapUserInfo={}) {
    const result = contents.map(content => {
        content['user_info'] = mapUserInfo[content['user_id']] ? mapUserInfo[content['user_id']] : {}
        return content
    })
    return result
}

async function callApi(api: string, params: any, method?: method): Promise<any>   {
    method = method || 'GET'
    const paramsString = querystring.stringify(params)
    if(api.includes('?')) {
        api = `${api}?`
    }
    api = `${api}${paramsString}`
    try {
        let result = JSON.parse(await rq(api))
        if(result['ret'] !== 0 || !result['data']) {
            return false
        }
        return result['data']
    } catch (err) {
        return false
    }
}

function setResInfo(res: any, ret: boolean, message: string, dataInfo: object, httpStatus?: number) {
    if(!httpStatus) {
        httpStatus = 200
    }
    let retInfo = {}
    if(!ret) {
        retInfo = {
            'code': -1,
            'message': message ? message : 'Error',
            'data': {}
        }
    } else {
        retInfo = {
            'code': true,
            'message': message ? message : 'success',
            'data': dataInfo ? dataInfo : {}
        }
    }
    res.writeHead(httpStatus, {'Content-Type': 'text/plain'})
    res.write(JSON.stringify(retInfo))
    res.end()
}

async function queryData(queryOption) {
    const client = await baseMongo.getClient();
    const collection = client.db("nodejs").collection("content");
    const queryArr = await collection.find(queryOption).toArray();
    return queryArr;
}