import https from 'https'
import http from 'http'

export interface Authentication {
    email: string
    token: string
}

export interface Zone {
    id: string
    name: string
}

export interface DNSRecord extends BaseDNSRecord {
    proxiable: boolean
    zone_id: string
    zone_name: string
}

export interface BaseDNSRecord {
    id: string
    zone_id: string
    type: string
    name: string
    content: string
    ttl: number
    proxied: boolean
}

interface Error {
    code: Number
    message: string
}

interface Response {
    success: boolean
    errors: [Error]
    messages: []
    result: any
}

enum RequestMethod {
    get = "GET",
    post = "POST",
    patch = "PATCH",
    put = "PUT"
}

export class Client {
    private baseURL: URL
    private headers: {[header: string]: string}

    constructor(auth: Authentication, baseURL: URL = new URL("https://api.cloudflare.com/client/v4/")) {
        this.baseURL = baseURL
        this.headers = {
            "Content-Type": "application/json",
            "X-Auth-Email": auth.email,
            "Authorization": "Bearer " + auth.token
        }
    }

    async updateRecord(updatedRecord: BaseDNSRecord) {
        const identifier = updatedRecord.id
        const zoneIdentifier = updatedRecord.zone_id
        const url = new URL("zones/" + zoneIdentifier + "/dns_records/" + identifier, this.baseURL)
        const update: object = {
            type: updatedRecord.type,
            name: updatedRecord.name,
            content: updatedRecord.content,
            ttl: updatedRecord.ttl,
            proxied: updatedRecord.proxied
        }
        const response = await this.makeRequest(RequestMethod.put, url, update)
        return response
    }

    async listDNSRecordsMatchinName(zoneName: string) {
        const zones = await this.listZonesMatchingName(zoneName)
        const zoneIdentifier = zones[0].id
        const records = await this.zoneDNSRecords(zoneIdentifier)
        return records
    }

    async zoneDNSRecords(zoneIdentifier: string) {
        const url = new URL("zones/" + zoneIdentifier + "/dns_records", this.baseURL)
        const response = await this.makeRequest(RequestMethod.get, url) as [DNSRecord]
        return response
    }

    async listZonesMatchingName(name: string) {
        const url = new URL("zones?name=" + name, this.baseURL)
        const response = await this.makeRequest(RequestMethod.get, url) as [Zone]
        return response        
    }

    private makeRequest(method: RequestMethod, url: URL, data?: object) {
        return new Promise((resolve, reject) => {
            const options = {
                headers: this.headers,
                method: method.valueOf()
            }

            const request = https.request(url.toString(), options, res => {
                let body = ""
                res.on("data", chunk => {
                    body += chunk
                })
                res.on("end", () => {
                    try {
                        console.debug("Response Received for " + request.method + " request to \"" + url.toString() + "\"...")
                        let response = JSON.parse(body) as Response
                        if (response.success) {
                            resolve(response.result)
                        } else {
                            reject(response.errors)
                        }
                    } catch (error) {
                        reject(error)
                    }
                })
            }).on("error", error => {
                reject(error)
            })

            console.debug("Making " + request.method + " request to \"" + url.toString() + "\"...")

            if (data != null) {
                request.write(JSON.stringify(data))
            }
            request.end()
        })
    }
}