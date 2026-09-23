use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};

fn main() {
    let listener  = TcpListener::bind("127.0.0.1:8080").unwrap();

    for stream in listener.incoming() {
        let stream = stream.unwrap();

        handle_connection(stream)
    }
}

fn handle_connection(mut stream: TcpStream) {
    let buf_reader = BufReader::new(&stream);
    let http_request: Vec<String> = buf_reader
        .lines()
        .map(|result| result.unwrap())
        .take_while(|line| !line.is_empty())
        .collect();

    let path = http_request
        .first()
        .and_then(|line| line.split_whitespace().nth(1))
        .unwrap_or("/");
    let file = match path {
        "/" => "static/index.html",
        "/styles.css" => "static/styles.css",
        "/script.js" => "static/script.js",
        _ => ""
    };

    let (status, contents) = match fs::read(file) {
        Ok(bytes) => ("200 OK", bytes),
        Err(_) => ("404 NOT FOUND",
                   fs::read("static/404.html").unwrap_or_else(|_| b"<h1>404</h1>".to_vec()))
    };

    let mime = match file.rsplit('.').next().unwrap_or("") {
        "html" => "text/html; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "js" => "text/javascript; charset=utf-8",
        _ => "text/plain; charset=utf-8",
    };

    let headers = format!(
        "HTTP/1.1 {status}\r\nContent-Type: {mime}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        contents.len()
    );
    stream.write_all(headers.as_bytes()).unwrap();
    stream.write_all(&contents).unwrap();
}