#!/usr/bin/env node
// NOTE: You can remove the first line if you don't plan to release an
// executable package. E.g. code that can be used as cli like prettier or eslint

import puppeteer, { Page } from "puppeteer";
import * as cheerio from "cheerio";
import path from "path";
import { format, compareAsc } from 'date-fns'
import dotenv from "dotenv";
dotenv.config();


const main = async () => {

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  console.log("new page opened");
  await page.goto("https://auth.dodois.io/");
  console.log("auth.dodois.io opened");
  await page.setViewport({ width: 1920, height: 1080 });
  await page.screenshot({
    path: path.resolve(__dirname, "auth.dodois.png"),
    fullPage: true,
  });
  await page.locator("input[name=Username]").fill(process.env.LOGIN!);
  await page.locator("input[type=password]").fill(process.env.PASSWORD!);

  await page.select("select[name=CountryCode]", "Uz");

  await page.screenshot({
    path: path.resolve(__dirname, "auth.dodois_filled.png"),
    fullPage: true,
  });
  console.log("form is filled");
  await page.click("button[type=submit]");
  console.log("submit is clicked");
  await page.waitForSelector(".profile__main");
  await page.goto("https://callcenter.dodopizza.uz/");
  console.log("https://callcenter.dodopizza.uz opened");
  console.log("wait for orders");
  await page.waitForSelector("#showMyOrders");
  console.log("found orders");
  await page.click("#showMyOrders");
  console.log("clicked orders");

  const result = await page.$$eval(".dashboard-table tbody tr", async (rows: HTMLTableRowElement[]) => {
    const promises = rows.map(async (row) => {
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const onClickAttr = row.getAttribute("onclick");
      if (!onClickAttr) {
        return {

        };
      }

      const regex = /[0-9A-F]{32}/;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const match = onClickAttr!.match(regex);
      if (match) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const orderId = match[0];
        console.log('row', row);
        const logs = await new Promise((resolve, reject) => {
          ajax.postJson('/Orders/GetLog', null, { orderUUId: orderId }, (data) => {
            console.log('data', data)
            resolve(data.logs);
          }, (error) => {
            reject(error);
          })
        });

        // console.log('logs', logs)
        // await new Promise((resolve) => { setTimeout(resolve, 50000) });
        const acceptedLog = logs.find(log => log.Message.indexOf('has been accepted') !== -1);
        if (acceptedLog) {

          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          const orderFromCell = row.querySelector(".b-table__col:nth-child(7)");
          console.log('orderFromCell', orderFromCell);

          if (orderFromCell) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            const orderFrom = orderFromCell.querySelector("span:first-child");
            console.log('orderFrom', orderFrom);
            if (orderFrom) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
              const orderFromText = orderFrom.textContent?.trim();
              console.log('orderFromText', orderFromText);
              if (orderFromText) {
                const regex = /^(\D+)\s\d+$/;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                const orderFromTextMatch = orderFromText.match(regex);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                if (orderFromTextMatch) {
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                  const orderFromTextMatch2 = orderFromTextMatch[1];
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                  switch (orderFromTextMatch2?.toLocaleLowerCase()) {
                    case "узум":
                      return {
                        date: acceptedLog.EventDateTime,
                        user: acceptedLog.EmployeeName,
                        orderId,
                        order_from: 'uzum'
                      };
                    case "exp":
                      return {
                        date: acceptedLog.EventDateTime,
                        user: acceptedLog.EmployeeName,
                        orderId,
                        order_from: 'express'
                      };
                    case "yan":
                      return {
                        date: acceptedLog.EventDateTime,
                        user: acceptedLog.EmployeeName,
                        orderId,
                        order_from: 'yandex'
                      };
                    default:
                      console.log("Unknown order from", orderFromTextMatch2);
                      return {
                        date: acceptedLog.EventDateTime,
                        user: acceptedLog.EmployeeName,
                        orderId,
                        order_from: 'others'
                      };
                  }
                } else {
                  console.log("No match found");
                  return {
                    date: acceptedLog.EventDateTime,
                    user: acceptedLog.EmployeeName,
                    orderId,
                    order_from: 'others'
                  };
                }
              } else {
                return {
                  date: acceptedLog.EventDateTime,
                  user: acceptedLog.EmployeeName,
                  orderId,
                  order_from: 'others'
                }
              }
            }
          }
        }
        return {
          orderId,
        };
      } else {
        console.error("No match found");
        return {

        };
      }
    });

    return await Promise.all(promises);
  });

  // console.log('result', result)

  const orders = result.filter(item => { return item.order_from !== undefined && item.user && item.user.length > 0 });

  // console.log('orders', orders)

  // const ordersData = await page.evaluate(async (orders) => {
  //   let result = {};

  //   for await (const order of orders) {
  //     result[order.orderId] = await new Promise((resolve, reject) => {
  //       ajax.postJson('/Orders/GetLog', null, { orderUUId: order.orderId }, (data) => {
  //         console.log('data', data)
  //         resolve({
  //           logs: data.logs,
  //           from: order.order_from
  //         });
  //       }, (error) => {
  //         reject(error);
  //       })
  //     });

  //   }

  //   return result;
  // }, orders)

  console.log('ordersData', orders)
  await new Promise((resolve) => { setTimeout(resolve, 10000) });
};

// This was just here to force a linting error for now to demonstrate/test the
// eslint pipeline. You can uncomment this and run "yarn check-lint" to test the
// linting.
// const x: number[] = [1, 2];
// const y: Array<number> = [3, 4];

// This was just here to force a linting error for now to demonstrate/test the
// eslint pipeline. You can uncomment this and run "yarn check-lint" to test the
// linting.
// if (x == y) {
//   console.log("equal!");
// }

main();
